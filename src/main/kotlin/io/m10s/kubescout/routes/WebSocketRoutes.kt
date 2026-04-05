package io.m10s.kubescout.routes

import io.m10s.kubescout.config.AppConfig
import io.m10s.kubescout.k8s.K8sServiceReader
import io.m10s.kubescout.k8s.K8sServiceReaderFactory
import mu.KotlinLogging
import org.springframework.context.annotation.Configuration
import org.springframework.http.server.ServerHttpRequest
import org.springframework.http.server.ServerHttpResponse
import org.springframework.stereotype.Component
import org.springframework.web.socket.BinaryMessage
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.config.annotation.EnableWebSocket
import org.springframework.web.socket.config.annotation.WebSocketConfigurer
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry
import org.springframework.web.socket.handler.AbstractWebSocketHandler
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator
import org.springframework.web.socket.server.HandshakeInterceptor
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

private val wsLogger = KotlinLogging.logger {}

// Uses K8S_NAME_REGEX from RouteUtils for resource name validation
private val WS_LOCALHOST_ORIGIN_REGEX = Regex("^https?://(localhost|127\\.0\\.0\\.1)(:\\d+)?$")
private val WS_CONTEXT_REGEX = Regex("^[a-zA-Z0-9@:._/-]{1,200}$")

// ==========================================
// CSRF Handshake Interceptor
// ==========================================

/**
 * Validates the WebSocket Origin header against the Host header.
 * In-cluster: Origin must match Host exactly (same-origin).
 * Local endpoints: Origin must be localhost or 127.0.0.1.
 */
class CsrfHandshakeInterceptor(private val requireLocalhost: Boolean = false) : HandshakeInterceptor {

    override fun beforeHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        attributes: MutableMap<String, Any>,
    ): Boolean {
        val origin = request.headers.getFirst("Origin")
        val host = request.headers.getFirst("Host")

        if (requireLocalhost) {
            if (origin == null || !WS_LOCALHOST_ORIGIN_REGEX.matches(origin)) {
                response.setStatusCode(org.springframework.http.HttpStatus.FORBIDDEN)
                return false
            }
        } else {
            if (origin == null || host == null) {
                response.setStatusCode(org.springframework.http.HttpStatus.FORBIDDEN)
                return false
            }
            val originHost = origin.removePrefix("https://").removePrefix("http://")
            if (originHost != host) {
                response.setStatusCode(org.springframework.http.HttpStatus.FORBIDDEN)
                return false
            }
        }
        return true
    }

    override fun afterHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        exception: Exception?,
    ) {}
}

// ==========================================
// WebSocket Configuration
// ==========================================

@Configuration
@EnableWebSocket
class WebSocketConfig(
    private val podShellHandler: PodShellWebSocketHandler,
    private val podShellLocalHandler: PodShellLocalWebSocketHandler,
    private val podLogsStreamHandler: PodLogsStreamWebSocketHandler,
    private val serviceLogsStreamHandler: ServiceLogsStreamWebSocketHandler,
) : WebSocketConfigurer {

    override fun registerWebSocketHandlers(registry: WebSocketHandlerRegistry) {
        registry.addHandler(podShellHandler, "/pod-shell")
            .addInterceptors(CsrfHandshakeInterceptor(requireLocalhost = false))
            .setAllowedOrigins("*") // origin validation is in the interceptor

        registry.addHandler(podShellLocalHandler, "/pod-shell-local")
            .addInterceptors(CsrfHandshakeInterceptor(requireLocalhost = true))
            .setAllowedOrigins("*")

        registry.addHandler(podLogsStreamHandler, "/pod-logs-stream-local")
            .addInterceptors(CsrfHandshakeInterceptor(requireLocalhost = true))
            .setAllowedOrigins("*")

        registry.addHandler(serviceLogsStreamHandler, "/service-logs-stream-local")
            .addInterceptors(CsrfHandshakeInterceptor(requireLocalhost = true))
            .setAllowedOrigins("*")
    }
}

// ==========================================
// Pod Shell Handler (in-cluster)
// ==========================================

@Component
class PodShellWebSocketHandler(
    private val appConfig: AppConfig,
    private val serviceReader: K8sServiceReader,
) : AbstractWebSocketHandler() {

    override fun afterConnectionEstablished(session: WebSocketSession) {
        val params = session.uri?.query?.toQueryParams() ?: emptyMap()
        val podName = params["pod"]?.trim().orEmpty()
        val containerName = params["container"]?.trim()?.takeIf { it.isNotBlank() }

        if (podName.isBlank()) {
            session.close(CloseStatus(CloseStatus.POLICY_VIOLATION.code, "Missing pod"))
            return
        }
        if (!K8S_NAME_REGEX.matches(podName)) {
            session.close(CloseStatus(CloseStatus.POLICY_VIOLATION.code, "Invalid pod name"))
            return
        }
        if (containerName != null && !K8S_NAME_REGEX.matches(containerName)) {
            session.close(CloseStatus(CloseStatus.POLICY_VIOLATION.code, "Invalid container name"))
            return
        }

        val concurrent = ConcurrentWebSocketSessionDecorator(session, 30_000, 64 * 1024)

        wsLogger.debug { "Shell: exec request pod=$podName ns=${appConfig.inClusterNamespace} container=$containerName" }
        val proc = try {
            serviceReader.execShellInCluster(podName, appConfig.inClusterNamespace, containerName)
        } catch (e: Exception) {
            wsLogger.error(e) { "Shell: exec FAILED for pod $podName" }
            val errMsg = "\r\n\u001b[31m[Exec failed: ${e::class.simpleName}: ${e.message?.take(200)?.replace("\n", " ")}]\u001b[0m\r\n"
            concurrent.sendMessage(BinaryMessage(errMsg.toByteArray(Charsets.UTF_8)))
            Thread.sleep(500)
            session.close(CloseStatus(CloseStatus.SERVER_ERROR.code, "Failed to exec"))
            return
        }

        setupShellSession(concurrent, session, proc, podName)
    }

    override fun handleBinaryMessage(session: WebSocketSession, message: BinaryMessage) {
        writeToProcess(session, message.payload.array())
    }

    override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
        writeToProcess(session, message.payload.toByteArray())
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
        cleanupSession(session)
    }
}

// ==========================================
// Pod Shell Handler (local kubeconfig)
// ==========================================

@Component
class PodShellLocalWebSocketHandler(
    private val localServiceReader: K8sServiceReader?,
    private val localReaderFactory: K8sServiceReaderFactory?,
) : AbstractWebSocketHandler() {

    override fun afterConnectionEstablished(session: WebSocketSession) {
        val reader = localServiceReader ?: run {
            session.close(CloseStatus(CloseStatus.POLICY_VIOLATION.code, "Local mode not enabled"))
            return
        }

        val params = session.uri?.query?.toQueryParams() ?: emptyMap()
        val podName = params["pod"]?.trim().orEmpty()
        val namespace = params["namespace"]?.trim().orEmpty()
        val context = params["context"]?.trim().orEmpty()
        val containerName = params["container"]?.trim()?.takeIf { it.isNotBlank() }

        if (podName.isBlank() || namespace.isBlank()) {
            session.close(CloseStatus(CloseStatus.POLICY_VIOLATION.code, "Missing pod or namespace"))
            return
        }
        if (!K8S_NAME_REGEX.matches(podName) || !K8S_NAME_REGEX.matches(namespace)) {
            session.close(CloseStatus(CloseStatus.POLICY_VIOLATION.code, "Invalid pod or namespace name"))
            return
        }
        if (context.isNotBlank() && !WS_CONTEXT_REGEX.matches(context)) {
            session.close(CloseStatus(CloseStatus.POLICY_VIOLATION.code, "Invalid context name"))
            return
        }
        if (containerName != null && !K8S_NAME_REGEX.matches(containerName)) {
            session.close(CloseStatus(CloseStatus.POLICY_VIOLATION.code, "Invalid container name"))
            return
        }

        val concurrent = ConcurrentWebSocketSessionDecorator(session, 30_000, 64 * 1024)
        val actualReader = localReaderFactory?.forContext(context) ?: reader

        wsLogger.debug { "Shell: exec request pod=$podName ns=$namespace container=$containerName" }
        val proc = try {
            actualReader.execShell(podName, namespace, containerName, context)
        } catch (e: Exception) {
            wsLogger.error(e) { "Shell: exec FAILED for pod $podName" }
            val errMsg = "\r\n\u001b[31m[Exec failed: ${e::class.simpleName}: ${e.message?.take(200)?.replace("\n", " ")}]\u001b[0m\r\n"
            concurrent.sendMessage(BinaryMessage(errMsg.toByteArray(Charsets.UTF_8)))
            Thread.sleep(500)
            session.close(CloseStatus(CloseStatus.SERVER_ERROR.code, "Failed to exec"))
            return
        }

        setupShellSession(concurrent, session, proc, podName)
    }

    override fun handleBinaryMessage(session: WebSocketSession, message: BinaryMessage) {
        writeToProcess(session, message.payload.array())
    }

    override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
        writeToProcess(session, message.payload.toByteArray())
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
        cleanupSession(session)
    }
}

// ==========================================
// Pod Log Stream Handler (local)
// ==========================================

@Component
class PodLogsStreamWebSocketHandler(
    private val localServiceReader: K8sServiceReader?,
    private val localReaderFactory: K8sServiceReaderFactory?,
) : AbstractWebSocketHandler() {

    override fun afterConnectionEstablished(session: WebSocketSession) {
        val fallbackReader = localServiceReader ?: run {
            session.close(CloseStatus(CloseStatus.POLICY_VIOLATION.code, "Local mode not enabled"))
            return
        }

        val params = session.uri?.query?.toQueryParams() ?: emptyMap()
        val podName = params["pod"]?.trim().orEmpty()
        val namespace = params["namespace"]?.trim().orEmpty()
        val context = params["context"]?.trim().orEmpty()
        val containerName = params["container"]?.trim()?.takeIf { it.isNotBlank() }
        val tailLines = (params["tailLines"]?.toIntOrNull() ?: 200).coerceIn(1, 10000)
        val sinceSeconds = params["sinceSeconds"]?.toIntOrNull()?.coerceIn(0, 86400)

        if (podName.isBlank() || namespace.isBlank()) {
            session.close(CloseStatus(CloseStatus.POLICY_VIOLATION.code, "Missing pod or namespace"))
            return
        }
        if (!K8S_NAME_REGEX.matches(podName) || !K8S_NAME_REGEX.matches(namespace)) {
            session.close(CloseStatus(CloseStatus.POLICY_VIOLATION.code, "Invalid pod or namespace name"))
            return
        }
        if (containerName != null && !K8S_NAME_REGEX.matches(containerName)) {
            session.close(CloseStatus(CloseStatus.POLICY_VIOLATION.code, "Invalid container name"))
            return
        }
        if (context.isNotBlank() && !WS_CONTEXT_REGEX.matches(context)) {
            session.close(CloseStatus(CloseStatus.POLICY_VIOLATION.code, "Invalid context name"))
            return
        }

        val concurrent = ConcurrentWebSocketSessionDecorator(session, 30_000, 64 * 1024)
        val reader = localReaderFactory?.forContext(context) ?: fallbackReader
        val running = AtomicBoolean(true)
        session.attributes["running"] = running

        wsLogger.debug { "LogStream: request pod=$podName ns=$namespace container=$containerName tail=$tailLines" }

        Thread.startVirtualThread {
            try {
                reader.streamPodLogs(podName, namespace, containerName, tailLines, sinceSeconds, context) { line ->
                    if (running.get() && concurrent.isOpen) {
                        concurrent.sendMessage(TextMessage(line))
                    }
                }
                wsLogger.debug { "LogStream: stream ended for pod=$podName" }
            } catch (e: Exception) {
                val msg = e.message ?: ""
                if (running.get() && concurrent.isOpen) {
                    if (isAwsSsoAuthError(e) || isKubeUnauthorized(e) ||
                        msg.contains("token", ignoreCase = true) || msg.contains("credentials", ignoreCase = true)
                    ) {
                        localReaderFactory?.invalidate(context)
                        tryClose(concurrent, """{"error":"auth","message":"${msg.take(300).replace("\"", "\\\"")}"}""")
                    } else {
                        tryClose(concurrent, """{"error":"general","message":"${msg.take(300).replace("\"", "\\\"")}"}""")
                    }
                }
            } finally {
                if (concurrent.isOpen) concurrent.close(CloseStatus.NORMAL)
            }
        }
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
        (session.attributes["running"] as? AtomicBoolean)?.set(false)
    }
}

// ==========================================
// Service Log Stream Handler (local)
// ==========================================

@Component
class ServiceLogsStreamWebSocketHandler(
    private val localServiceReader: K8sServiceReader?,
    private val localReaderFactory: K8sServiceReaderFactory?,
) : AbstractWebSocketHandler() {

    override fun afterConnectionEstablished(session: WebSocketSession) {
        val fallbackReader = localServiceReader ?: run {
            session.close(CloseStatus(CloseStatus.POLICY_VIOLATION.code, "Local mode not enabled"))
            return
        }

        val params = session.uri?.query?.toQueryParams() ?: emptyMap()
        val serviceName = params["service"]?.trim().orEmpty()
        val namespace = params["namespace"]?.trim().orEmpty()
        val context = params["context"]?.trim().orEmpty()
        val tailLines = (params["tailLines"]?.toIntOrNull() ?: 50).coerceIn(1, 10000)
        val sinceSeconds = params["sinceSeconds"]?.toIntOrNull()?.coerceIn(0, 86400)

        if (serviceName.isBlank() || namespace.isBlank()) {
            session.close(CloseStatus(CloseStatus.POLICY_VIOLATION.code, "Missing service or namespace"))
            return
        }
        if (!K8S_NAME_REGEX.matches(serviceName) || !K8S_NAME_REGEX.matches(namespace)) {
            session.close(CloseStatus(CloseStatus.POLICY_VIOLATION.code, "Invalid service or namespace name"))
            return
        }
        if (context.isNotBlank() && !WS_CONTEXT_REGEX.matches(context)) {
            session.close(CloseStatus(CloseStatus.POLICY_VIOLATION.code, "Invalid context name"))
            return
        }

        val concurrent = ConcurrentWebSocketSessionDecorator(session, 30_000, 64 * 1024)
        val reader = localReaderFactory?.forContext(context) ?: fallbackReader
        val running = AtomicBoolean(true)
        session.attributes["running"] = running

        Thread.startVirtualThread {
            // Fetch pods first
            val pods = try {
                reader.fetchPodResourceDetailsForService(serviceName, namespace)
            } catch (e: Exception) {
                val msg = e.message ?: "Failed to fetch pods"
                val isAuth = isAwsSsoAuthError(e) || isKubeUnauthorized(e) ||
                    msg.contains("token", ignoreCase = true) || msg.contains("credentials", ignoreCase = true)
                if (isAuth) localReaderFactory?.invalidate(context)
                val errorType = if (isAuth) "auth" else "general"
                if (concurrent.isOpen) {
                    concurrent.sendMessage(TextMessage("""{"error":"$errorType","message":"${msg.take(300).replace("\"", "\\\"")}"}"""))
                    concurrent.close(CloseStatus.NORMAL)
                }
                return@startVirtualThread
            }

            if (pods.isEmpty()) {
                if (concurrent.isOpen) {
                    concurrent.sendMessage(TextMessage("""{"error":"general","message":"No pods found for service $serviceName"}"""))
                    concurrent.close(CloseStatus.NORMAL)
                }
                return@startVirtualThread
            }

            wsLogger.debug { "ServiceLogStream: service=$serviceName pods=${pods.size} ns=$namespace" }

            val logQueue = LinkedBlockingQueue<String>(4096)
            val activeThreads = java.util.concurrent.atomic.AtomicInteger(pods.size)

            // Start one virtual thread per pod
            pods.forEach { pod ->
                Thread.startVirtualThread {
                    try {
                        val podShortId = pod.podName.substringAfterLast("-")
                        reader.streamPodLogs(pod.podName, namespace, null, tailLines, sinceSeconds, context) { line ->
                            if (running.get()) logQueue.offer("[$podShortId] $line", 5, TimeUnit.SECONDS)
                        }
                        wsLogger.debug { "ServiceLogStream: stream ended for pod=${pod.podName}" }
                    } catch (e: Exception) {
                        val msg = e.message ?: ""
                        if (msg.contains("token", ignoreCase = true) || msg.contains("credentials", ignoreCase = true)) {
                            logQueue.offer("\u0000AUTH_ERROR\u0000${msg.take(300)}", 5, TimeUnit.SECONDS)
                        } else {
                            wsLogger.warn { "ServiceLogStream: error for pod=${pod.podName}: ${e::class.simpleName}: $msg" }
                        }
                    } finally {
                        if (activeThreads.decrementAndGet() == 0) {
                            logQueue.offer("\u0000DONE\u0000", 5, TimeUnit.SECONDS)
                        }
                    }
                }
            }

            // Drain queue and forward to browser
            try {
                while (running.get() && concurrent.isOpen) {
                    val line = logQueue.poll(200, TimeUnit.MILLISECONDS) ?: continue
                    when {
                        line == "\u0000DONE\u0000" -> break
                        line.startsWith("\u0000AUTH_ERROR\u0000") -> {
                            val msg = line.removePrefix("\u0000AUTH_ERROR\u0000")
                            concurrent.sendMessage(TextMessage("""{"error":"auth","message":"${msg.replace("\"", "\\\"")}"}"""))
                            break
                        }
                        else -> concurrent.sendMessage(TextMessage(line))
                    }
                }
            } catch (e: Exception) {
                wsLogger.warn { "ServiceLogStream: outgoing send error: ${e::class.simpleName}: ${e.message}" }
            } finally {
                running.set(false)
                if (concurrent.isOpen) concurrent.close(CloseStatus.NORMAL)
            }
        }
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
        (session.attributes["running"] as? AtomicBoolean)?.set(false)
    }
}

// ==========================================
// Shared shell helpers
// ==========================================

private fun setupShellSession(concurrent: ConcurrentWebSocketSessionDecorator, session: WebSocketSession, proc: Process, podName: String) {
    val running = AtomicBoolean(true)
    val outputQueue = LinkedBlockingQueue<ByteArray>(1024)

    session.attributes["process"] = proc
    session.attributes["running"] = running

    // Read stdout
    Thread.startVirtualThread {
        try {
            val buf = ByteArray(4096)
            var n = 0
            while (running.get() && proc.inputStream.read(buf).also { n = it } != -1) {
                outputQueue.put(buf.copyOf(n))
            }
            wsLogger.debug { "Shell: stdout EOF for pod=$podName" }
        } catch (e: Exception) {
            wsLogger.warn { "Shell: stdout error: ${e::class.simpleName}: ${e.message}" }
        } finally {
            outputQueue.put(ByteArray(0)) // sentinel
        }
    }

    // Read stderr
    Thread.startVirtualThread {
        try {
            val buf = ByteArray(4096)
            var n = 0
            while (running.get() && proc.errorStream.read(buf).also { n = it } != -1) {
                outputQueue.put(buf.copyOf(n))
            }
            wsLogger.debug { "Shell: stderr EOF for pod=$podName" }
        } catch (e: Exception) {
            wsLogger.warn { "Shell: stderr error: ${e::class.simpleName}: ${e.message}" }
        }
    }

    // Send banner, drain queue and forward to browser
    Thread.startVirtualThread {
        try {
            val banner = "\r\n\u001b[32m\u001b[1m Connected to $podName \u001b[0m\r\n" +
                "\u001b[90m Type 'exit' or press Ctrl+D to close\u001b[0m\r\n\r\n"
            concurrent.sendMessage(BinaryMessage(banner.toByteArray(Charsets.UTF_8)))
            wsLogger.debug { "Shell: banner sent, forwarding subprocess output for pod=$podName" }

            while (running.get() || outputQueue.isNotEmpty()) {
                val data = outputQueue.poll(100, TimeUnit.MILLISECONDS) ?: continue
                if (data.isEmpty()) break // sentinel
                if (concurrent.isOpen) concurrent.sendMessage(BinaryMessage(data))
            }
            wsLogger.debug { "Shell: subprocess output drained for pod=$podName" }
        } catch (e: Exception) {
            wsLogger.warn { "Shell: outgoing send error: ${e::class.simpleName}: ${e.message}" }
        } finally {
            running.set(false)
            try { proc.destroyForcibly() } catch (_: Exception) {}
            if (concurrent.isOpen) concurrent.close(CloseStatus.NORMAL)
        }
    }
}

private fun writeToProcess(session: WebSocketSession, data: ByteArray) {
    val proc = session.attributes["process"] as? Process ?: return
    try {
        proc.outputStream.write(data)
        proc.outputStream.flush()
    } catch (e: Exception) {
        wsLogger.warn { "Shell: failed to write to process stdin: ${e.message}" }
    }
}

private fun cleanupSession(session: WebSocketSession) {
    (session.attributes["running"] as? AtomicBoolean)?.set(false)
    val proc = session.attributes["process"] as? Process
    try { proc?.destroyForcibly() } catch (_: Exception) {}
}

private fun tryClose(session: ConcurrentWebSocketSessionDecorator, errorJson: String) {
    try {
        session.sendMessage(TextMessage(errorJson))
        session.close(CloseStatus.NORMAL)
    } catch (_: Exception) {}
}

// ==========================================
// Query string parsing helper
// ==========================================

private fun String.toQueryParams(): Map<String, String> {
    return split("&").mapNotNull { pair ->
        val idx = pair.indexOf('=')
        if (idx < 0) null
        else pair.substring(0, idx) to java.net.URLDecoder.decode(pair.substring(idx + 1), "UTF-8")
    }.toMap()
}
