package io.m10s.kubescout.routes

import io.m10s.kubescout.config.AppConfig
import io.m10s.kubescout.k8s.K8sServiceReader
import io.m10s.kubescout.k8s.K8sServiceReaderFactory
import io.m10s.kubescout.model.ErrorResponse
import io.m10s.kubescout.model.PodResourceDetailsResponse
import io.m10s.kubescout.model.ServiceEventsResponse
import mu.KotlinLogging
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

private val logger = KotlinLogging.logger {}
// Uses K8S_NAME_REGEX from RouteUtils

@RestController
class PodController(
    private val appConfig: AppConfig,
    private val serviceReader: K8sServiceReader,
    private val localServiceReader: K8sServiceReader?,
    private val localReaderFactory: K8sServiceReaderFactory?,
) {

    @GetMapping("/service-pods")
    fun servicePods(
        @RequestParam(required = false) service: String?,
        @RequestParam(required = false) namespace: String?,
    ): ResponseEntity<*> {
        val serviceName = service?.trim().orEmpty()
        if (serviceName.isBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required query param: service"))
        }
        return try {
            val ns = if (namespace.isNullOrBlank()) serviceReader.resolveCurrentNamespace() else namespace.trim()
            val pods = serviceReader.fetchPodResourceDetailsForService(serviceName = serviceName, namespace = ns)
            ResponseEntity.ok(PodResourceDetailsResponse(serviceName = serviceName, namespace = ns, pods = pods))
        } catch (error: Exception) {
            ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse("Failed to load pods for service '$serviceName': ${sanitizeErrorMessage(error.message)}"))
        }
    }

    @GetMapping("/service-pods-batch")
    fun servicePodsBatch(
        @RequestParam(required = false) service: List<String>?,
        @RequestParam(required = false) namespace: String?,
    ): ResponseEntity<*> {
        val serviceNames = service?.map { it.trim() }?.filter { it.isNotBlank() }?.distinct() ?: emptyList()
        if (serviceNames.isEmpty()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required query param: service"))
        }
        return try {
            val ns = if (namespace.isNullOrBlank()) serviceReader.resolveCurrentNamespace() else namespace.trim()
            val results = mutableMapOf<String, PodResourceDetailsResponse>()
            serviceNames.forEach { name ->
                val pods = serviceReader.fetchPodResourceDetailsForService(serviceName = name, namespace = ns)
                results[name] = PodResourceDetailsResponse(serviceName = name, namespace = ns, pods = pods)
            }
            ResponseEntity.ok(results)
        } catch (error: Exception) {
            ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse("Failed to load pods: ${sanitizeErrorMessage(error.message)}"))
        }
    }

    @GetMapping("/service-pods-local")
    fun servicePodsLocal(
        @RequestParam(required = false) service: String?,
        @RequestParam(required = false) namespace: String?,
        @RequestParam(required = false) context: String?,
    ): ResponseEntity<*> {
        val reader = localServiceReader
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Local mode not enabled"))

        val rawServiceName = service?.trim()
        val rawNamespace = namespace?.trim()
        val rawContext = context?.trim()

        val resolvedContext = if (rawContext.isNullOrBlank()) "" else {
            validateParam(rawContext)
                ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid context parameter"))
        }
        if (rawServiceName.isNullOrBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required query param: service"))
        }
        if (rawNamespace.isNullOrBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required query param: namespace"))
        }
        val serviceName = validateParam(rawServiceName)
            ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid service parameter"))
        val validatedNamespace = validateParam(rawNamespace)
            ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid namespace parameter"))

        return try {
            val actualReader = localReaderFactory?.forContext(resolvedContext) ?: reader
            val pods = actualReader.fetchPodResourceDetailsForService(serviceName = serviceName, namespace = validatedNamespace)
            ResponseEntity.ok(PodResourceDetailsResponse(serviceName = serviceName, namespace = validatedNamespace, pods = pods))
        } catch (error: Exception) {
            invalidateOnAuthError(error, resolvedContext, localReaderFactory)
            if (isAwsSsoAuthError(error) || isKubeUnauthorized(error)) {
                logger.warn { "Failed to list service-pods-local (auth): ${friendlyLocalServiceListErrorMessage(error)}" }
            } else {
                logger.error(error) { "Failed to list service-pods-local" }
            }
            ResponseEntity
                .status(localErrorStatus(error))
                .body(ErrorResponse("Failed to load pods for service '$serviceName': ${friendlyLocalServiceListErrorMessage(error)}"))
        }
    }

    @GetMapping("/service-pods-local-batch")
    fun servicePodsLocalBatch(
        @RequestParam(required = false) service: List<String>?,
        @RequestParam(required = false) namespace: String?,
        @RequestParam(required = false) context: String?,
    ): ResponseEntity<*> {
        val reader = localServiceReader
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Local mode not enabled"))

        val serviceNames = service?.map { it.trim() }?.filter { it.isNotBlank() }?.distinct() ?: emptyList()
        val rawNamespace = namespace?.trim()
        val rawContext = context?.trim()

        val resolvedContext = if (rawContext.isNullOrBlank()) "" else {
            validateParam(rawContext)
                ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid context parameter"))
        }
        if (serviceNames.isEmpty()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required query param: service"))
        }
        if (rawNamespace.isNullOrBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required query param: namespace"))
        }
        val validatedNamespace = validateParam(rawNamespace)
            ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid namespace parameter"))

        val validatedServiceNames = serviceNames.map { name ->
            validateParam(name) ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid service parameter: $name"))
        }

        return try {
            val actualReader = localReaderFactory?.forContext(resolvedContext) ?: reader
            val results = mutableMapOf<String, PodResourceDetailsResponse>()
            validatedServiceNames.forEach { name ->
                val pods = actualReader.fetchPodResourceDetailsForService(serviceName = name, namespace = validatedNamespace)
                results[name] = PodResourceDetailsResponse(serviceName = name, namespace = validatedNamespace, pods = pods)
            }
            ResponseEntity.ok(results)
        } catch (error: Exception) {
            invalidateOnAuthError(error, resolvedContext, localReaderFactory)
            if (isAwsSsoAuthError(error) || isKubeUnauthorized(error)) {
                logger.warn { "Failed to list service-pods-local-batch (auth): ${friendlyLocalServiceListErrorMessage(error)}" }
            } else {
                logger.error(error) { "Failed to list service-pods-local-batch" }
            }
            ResponseEntity
                .status(localErrorStatus(error))
                .body(ErrorResponse("Failed to load pods: ${friendlyLocalServiceListErrorMessage(error)}"))
        }
    }

    @GetMapping("/problematic-pods-local")
    fun problematicPodsLocal(
        @RequestParam(required = false) namespace: String?,
        @RequestParam(required = false) context: String?,
    ): ResponseEntity<*> {
        val reader = localServiceReader
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Local mode not enabled"))

        val rawNamespace = namespace?.trim().orEmpty()
        val rawContext = context?.trim()

        val resolvedContext = if (rawContext.isNullOrBlank()) "" else {
            validateParam(rawContext)
                ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid context parameter"))
        }
        if (rawNamespace.isBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required query param: namespace"))
        }
        val validatedNamespace = validateParam(rawNamespace)
            ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid namespace parameter"))

        return try {
            val actualReader = localReaderFactory?.forContext(resolvedContext) ?: reader
            val pods = actualReader.fetchProblematicPods(validatedNamespace)
            ResponseEntity.ok(mapOf("pods" to pods))
        } catch (error: Exception) {
            invalidateOnAuthError(error, resolvedContext, localReaderFactory)
            if (isAwsSsoAuthError(error) || isKubeUnauthorized(error)) {
                logger.warn { "Failed to list problematic-pods-local (auth): ${friendlyLocalServiceListErrorMessage(error)}" }
            } else {
                logger.error(error) { "Failed to list problematic-pods-local" }
            }
            ResponseEntity
                .status(localErrorStatus(error))
                .body(ErrorResponse("Failed to load problematic pods: ${friendlyLocalServiceListErrorMessage(error)}"))
        }
    }

    @GetMapping("/pod-events")
    fun podEvents(
        @RequestParam(required = false) service: String?,
        @RequestParam(required = false) namespace: String?,
    ): ResponseEntity<*> {
        val serviceName = service?.trim().orEmpty()
        if (serviceName.isBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required query param: service"))
        }
        return try {
            val ns = if (namespace.isNullOrBlank()) serviceReader.resolveCurrentNamespace() else namespace.trim()
            val events = serviceReader.fetchServiceEvents(serviceName, ns)
            ResponseEntity.ok(ServiceEventsResponse(serviceName, ns, events))
        } catch (error: Exception) {
            logger.error(error) { "Failed to fetch pod events for service $serviceName" }
            ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse("Failed to fetch pod events: ${sanitizeErrorMessage(error.message)}"))
        }
    }

    @GetMapping("/pod-events-local")
    fun podEventsLocal(
        @RequestParam(required = false) service: String?,
        @RequestParam(required = false) namespace: String?,
        @RequestParam(required = false) context: String?,
    ): ResponseEntity<*> {
        val reader = localServiceReader
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Local mode not enabled"))

        val rawServiceName = service?.trim()
        val rawNamespace = namespace?.trim()
        val rawContext = context?.trim()

        val resolvedContext = if (rawContext.isNullOrBlank()) "" else {
            validateParam(rawContext)
                ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid context parameter"))
        }
        if (rawServiceName.isNullOrBlank() || rawNamespace.isNullOrBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required query params: service, namespace"))
        }
        val serviceName = validateParam(rawServiceName)
            ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid service parameter"))
        val validatedNamespace = validateParam(rawNamespace)
            ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid namespace parameter"))

        return try {
            val actualReader = localReaderFactory?.forContext(resolvedContext) ?: reader
            val events = actualReader.fetchServiceEvents(serviceName, validatedNamespace)
            ResponseEntity.ok(ServiceEventsResponse(serviceName, validatedNamespace, events))
        } catch (error: Exception) {
            invalidateOnAuthError(error, resolvedContext, localReaderFactory)
            if (isAwsSsoAuthError(error) || isKubeUnauthorized(error)) {
                logger.warn { "Failed to fetch pod-events-local (auth): ${friendlyLocalServiceListErrorMessage(error)}" }
            } else {
                logger.error(error) { "Failed to fetch pod-events-local for service $serviceName" }
            }
            ResponseEntity
                .status(localErrorStatus(error))
                .body(ErrorResponse("Failed to fetch pod events: ${friendlyLocalServiceListErrorMessage(error)}"))
        }
    }

    @GetMapping("/pod-logs")
    fun podLogs(
        @RequestParam(required = false) pod: String?,
        @RequestParam(required = false) namespace: String?,
        @RequestParam(required = false) container: String?,
        @RequestParam(required = false) tailLines: Int?,
        @RequestParam(required = false) sinceSeconds: Int?,
    ): ResponseEntity<*> {
        val podName = pod?.trim().orEmpty()
        if (podName.isBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required query param: pod"))
        }
        val resolvedTailLines = (tailLines ?: 500).coerceIn(1, 10000)
        val resolvedSinceSeconds = sinceSeconds?.coerceIn(0, 86400)

        val containerName = if (container != null) {
            validateParam(container)
                ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid container parameter"))
        } else null

        return try {
            val ns = if (namespace.isNullOrBlank()) serviceReader.resolveCurrentNamespace() else namespace.trim()
            val response = serviceReader.fetchPodLogs(podName, ns, containerName, resolvedTailLines, resolvedSinceSeconds)
            ResponseEntity.ok(response)
        } catch (error: Exception) {
            logger.error(error) { "Failed to fetch pod logs for $podName" }
            ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse("Failed to fetch pod logs: ${sanitizeErrorMessage(error.message)}"))
        }
    }

    @GetMapping("/pod-logs-local")
    fun podLogsLocal(
        @RequestParam(required = false) pod: String?,
        @RequestParam(required = false) namespace: String?,
        @RequestParam(required = false) container: String?,
        @RequestParam(required = false) context: String?,
        @RequestParam(required = false) tailLines: Int?,
        @RequestParam(required = false) sinceSeconds: Int?,
    ): ResponseEntity<*> {
        val reader = localServiceReader
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Local mode not enabled"))

        val rawPodName = pod?.trim()
        val rawNamespace = namespace?.trim()
        val rawContext = context?.trim()

        val resolvedContext = if (rawContext.isNullOrBlank()) "" else {
            validateParam(rawContext)
                ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid context parameter"))
        }
        val resolvedTailLines = (tailLines ?: 500).coerceIn(1, 10000)
        val resolvedSinceSeconds = sinceSeconds?.coerceIn(0, 86400)

        if (rawPodName.isNullOrBlank() || rawNamespace.isNullOrBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required query params: pod, namespace"))
        }
        val podName = validateParam(rawPodName)
            ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid pod parameter"))
        val validatedNamespace = validateParam(rawNamespace)
            ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid namespace parameter"))
        val containerName = if (container != null) {
            validateParam(container)
                ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid container parameter"))
        } else null

        return try {
            val actualReader = localReaderFactory?.forContext(resolvedContext) ?: reader
            val response = actualReader.fetchPodLogs(podName, validatedNamespace, containerName, resolvedTailLines, resolvedSinceSeconds)
            ResponseEntity.ok(response)
        } catch (error: Exception) {
            invalidateOnAuthError(error, resolvedContext, localReaderFactory)
            if (isAwsSsoAuthError(error) || isKubeUnauthorized(error)) {
                logger.warn { "Failed to fetch pod-logs-local (auth): ${friendlyLocalServiceListErrorMessage(error)}" }
            } else {
                logger.error(error) { "Failed to fetch pod-logs-local for $podName" }
            }
            ResponseEntity
                .status(localErrorStatus(error))
                .body(ErrorResponse("Failed to fetch pod logs: ${friendlyLocalServiceListErrorMessage(error)}"))
        }
    }

    @GetMapping("/pod-containers")
    fun podContainers(@RequestParam(required = false) pod: String?): ResponseEntity<*> {
        val podName = pod?.trim().orEmpty()
        if (podName.isBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required param: pod"))
        }
        if (!K8S_NAME_REGEX.matches(podName)) {
            return ResponseEntity.badRequest().body(ErrorResponse("Invalid pod name"))
        }
        return try {
            val containers = serviceReader.listContainersForPod(podName, appConfig.inClusterNamespace)
            ResponseEntity.ok(containers)
        } catch (error: Exception) {
            ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse("Failed to list containers: ${sanitizeErrorMessage(error.message)}"))
        }
    }

    @GetMapping("/pod-containers-local")
    fun podContainersLocal(
        @RequestParam(required = false) pod: String?,
        @RequestParam(required = false) namespace: String?,
        @RequestParam(required = false) context: String?,
    ): ResponseEntity<*> {
        val reader = localServiceReader
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Local mode not enabled"))

        val podName = pod?.trim().orEmpty()
        val rawNamespace = namespace?.trim().orEmpty()
        val rawContext = context?.trim()

        val resolvedContext = if (rawContext.isNullOrBlank()) "" else {
            validateParam(rawContext)
                ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid context parameter"))
        }

        if (podName.isBlank() || rawNamespace.isBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required params: pod, namespace"))
        }
        if (!K8S_NAME_REGEX.matches(podName) || !K8S_NAME_REGEX.matches(rawNamespace)) {
            return ResponseEntity.badRequest().body(ErrorResponse("Invalid pod or namespace name"))
        }

        return try {
            val actualReader = localReaderFactory?.forContext(resolvedContext) ?: reader
            val containers = actualReader.listContainersForPod(podName, rawNamespace)
            ResponseEntity.ok(containers)
        } catch (error: Exception) {
            invalidateOnAuthError(error, resolvedContext, localReaderFactory)
            ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse("Failed to list containers: ${sanitizeErrorMessage(error.message)}"))
        }
    }
}
