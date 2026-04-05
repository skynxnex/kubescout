package io.m10s.kss.routes

import io.m10s.kss.config.AppConfig
import io.m10s.kss.k8s.K8sServiceReader
import io.m10s.kss.k8s.K8sServiceReaderFactory
import io.m10s.kss.model.ErrorResponse
import io.m10s.kss.model.ServiceSummaryResponse
import mu.KotlinLogging
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

private val logger = KotlinLogging.logger {}

@RestController
class ServiceController(
    private val appConfig: AppConfig,
    private val serviceReader: K8sServiceReader,
    private val localServiceReader: K8sServiceReader?,
    private val localReaderFactory: K8sServiceReaderFactory?,
) {

    @GetMapping("/services")
    fun services(@RequestParam(required = false) prefix: List<String>?): ResponseEntity<*> {
        val prefixes = prefix?.map { it.trim() }?.filter { it.isNotBlank() }?.distinct()
            ?: listOf("app-")

        return try {
            val summaries = if (appConfig.localMode) {
                if (appConfig.localNamespace.isBlank()) {
                    throw IllegalArgumentException("LOCAL_NAMESPACE is required when LOCAL_MODE=true")
                }
                serviceReader.fetchServiceSummaries(prefixes, listOf(appConfig.localNamespace))
            } else {
                serviceReader.fetchServiceSummaries(prefixes)
            }
            ResponseEntity.ok(ServiceSummaryResponse(summaries))
        } catch (error: Exception) {
            if (isAwsSsoAuthError(error)) {
                logger.warn { "Failed to list services (auth): ${friendlyServiceListErrorMessage(error)}" }
            }
            ResponseEntity
                .status(if (isAwsSsoAuthError(error)) HttpStatus.UNAUTHORIZED else HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse(friendlyServiceListErrorMessage(error)))
        }
    }

    @GetMapping("/services-local")
    fun servicesLocal(
        @RequestParam(required = false) prefix: List<String>?,
        @RequestParam(required = false) namespace: List<String>?,
        @RequestParam(required = false) context: String?,
    ): ResponseEntity<*> {
        val reader = localServiceReader
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Local mode not enabled"))

        val rawPrefixes = prefix?.map { it.trim() }?.filter { it.isNotBlank() }?.distinct()
            ?: listOf("app-")

        val validatedPrefixes = mutableListOf<String>()
        for (p in rawPrefixes) {
            val validated = validateParam(p)
                ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid prefix parameter"))
            validatedPrefixes.add(validated)
        }
        val prefixes = validatedPrefixes

        val rawNamespaces = namespace?.map { it.trim() }?.filter { it.isNotBlank() }
        val rawContext = context?.trim()

        val resolvedContext = if (rawContext.isNullOrBlank()) "" else {
            validateParam(rawContext)
                ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid context parameter"))
        }

        if (rawNamespaces.isNullOrEmpty()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required query param: namespace"))
        }

        val validatedNamespaces = mutableListOf<String>()
        for (ns in rawNamespaces) {
            val validated = validateParam(ns)
                ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid namespace parameter"))
            validatedNamespaces.add(validated)
        }
        val distinctNamespaces = validatedNamespaces.distinct()

        if (distinctNamespaces.size > 10) {
            return ResponseEntity.badRequest().body(ErrorResponse("Too many namespaces: max 10 allowed"))
        }

        return try {
            val actualReader = localReaderFactory?.forContext(resolvedContext) ?: reader
            val summaries = actualReader.fetchServiceSummaries(prefixes, distinctNamespaces)
            ResponseEntity.ok(ServiceSummaryResponse(summaries))
        } catch (error: Exception) {
            invalidateOnAuthError(error, resolvedContext, localReaderFactory)
            if (isAwsSsoAuthError(error) || isKubeUnauthorized(error)) {
                logger.warn { "Failed to list services-local (auth): ${friendlyLocalServiceListErrorMessage(error)}" }
            } else {
                logger.error(error) { "Failed to list services-local" }
            }
            ResponseEntity
                .status(localErrorStatus(error))
                .body(ErrorResponse(friendlyLocalServiceListErrorMessage(error)))
        }
    }

    @GetMapping("/contexts-local")
    fun contextsLocal(): ResponseEntity<*> {
        val reader = localServiceReader
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Local mode not enabled"))

        return try {
            val contexts = reader.fetchContexts()
            ResponseEntity.ok(mapOf("contexts" to contexts))
        } catch (error: Exception) {
            logger.error(error) { "Failed to list contexts-local" }
            ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse("Failed to list contexts: ${sanitizeErrorMessage(error.message)}"))
        }
    }

    @GetMapping("/namespaces-local")
    fun namespacesLocal(@RequestParam(required = false) context: String?): ResponseEntity<*> {
        val reader = localServiceReader
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Local mode not enabled"))

        val rawContext = context?.trim()
        val resolvedContext = if (rawContext.isNullOrBlank()) "" else {
            validateParam(rawContext)
                ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid context parameter"))
        }

        return try {
            val actualReader = localReaderFactory?.forContext(resolvedContext) ?: reader
            val namespaces = actualReader.fetchNamespaces()
            ResponseEntity.ok(mapOf("namespaces" to namespaces))
        } catch (error: Exception) {
            invalidateOnAuthError(error, resolvedContext, localReaderFactory)
            if (isAwsSsoAuthError(error) || isKubeUnauthorized(error)) {
                logger.warn { "Failed to list namespaces-local (auth): ${friendlyLocalServiceListErrorMessage(error)}" }
            } else {
                logger.error(error) { "Failed to list namespaces-local" }
            }
            ResponseEntity
                .status(localErrorStatus(error))
                .body(ErrorResponse("Failed to list namespaces: ${friendlyLocalServiceListErrorMessage(error)}"))
        }
    }
}
