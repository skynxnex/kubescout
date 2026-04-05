package io.m10s.kubescout.routes

import io.m10s.kubescout.config.AppConfig
import io.m10s.kubescout.k8s.K8sServiceReader
import io.m10s.kubescout.k8s.K8sServiceReaderFactory
import io.m10s.kubescout.model.ErrorResponse
import mu.KotlinLogging
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

private val logger = KotlinLogging.logger {}

@RestController
class ConfigController(
    private val appConfig: AppConfig,
    private val serviceReader: K8sServiceReader,
    private val localServiceReader: K8sServiceReader?,
    private val localReaderFactory: K8sServiceReaderFactory?,
) {

    @GetMapping("/service-configs")
    fun serviceConfigs(@RequestParam(required = false) service: String?): ResponseEntity<*> {
        val serviceName = service?.trim().orEmpty()
        if (serviceName.isBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required query param: service"))
        }
        return try {
            val response = serviceReader.fetchServiceConfigs(serviceName, appConfig.inClusterNamespace)
            ResponseEntity.ok(response)
        } catch (error: Exception) {
            logger.error(error) { "Failed to fetch service-configs for $serviceName" }
            ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse("Failed to fetch service configs: ${sanitizeErrorMessage(error.message)}"))
        }
    }

    @GetMapping("/service-configs-local")
    fun serviceConfigsLocal(
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
            val response = actualReader.fetchServiceConfigs(serviceName, validatedNamespace)
            ResponseEntity.ok(response)
        } catch (error: Exception) {
            invalidateOnAuthError(error, resolvedContext, localReaderFactory)
            if (isAwsSsoAuthError(error) || isKubeUnauthorized(error)) {
                logger.warn { "Failed to fetch service-configs-local (auth): ${friendlyLocalServiceListErrorMessage(error)}" }
            } else {
                logger.error(error) { "Failed to fetch service-configs-local for $serviceName" }
            }
            ResponseEntity
                .status(localErrorStatus(error))
                .body(ErrorResponse("Failed to fetch service configs: ${friendlyLocalServiceListErrorMessage(error)}"))
        }
    }

    @GetMapping("/configmap-data")
    fun configMapData(@RequestParam(required = false) name: String?): ResponseEntity<*> {
        val cmName = name?.trim().orEmpty()
        if (cmName.isBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required query param: name"))
        }
        return try {
            val response = serviceReader.fetchConfigMapData(cmName, appConfig.inClusterNamespace)
            ResponseEntity.ok(response)
        } catch (error: Exception) {
            logger.error(error) { "Failed to fetch configmap-data for $cmName" }
            ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse("Failed to fetch ConfigMap data: ${sanitizeErrorMessage(error.message)}"))
        }
    }

    @GetMapping("/configmap-data-local")
    fun configMapDataLocal(
        @RequestParam(required = false) name: String?,
        @RequestParam(required = false) namespace: String?,
        @RequestParam(required = false) context: String?,
    ): ResponseEntity<*> {
        val reader = localServiceReader
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Local mode not enabled"))

        val rawName = name?.trim()
        val rawNamespace = namespace?.trim()
        val rawContext = context?.trim()

        val resolvedContext = if (rawContext.isNullOrBlank()) "" else {
            validateParam(rawContext)
                ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid context parameter"))
        }
        if (rawName.isNullOrBlank() || rawNamespace.isNullOrBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required query params: name, namespace"))
        }
        val cmName = validateParam(rawName)
            ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid name parameter"))
        val validatedNamespace = validateParam(rawNamespace)
            ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid namespace parameter"))

        return try {
            val actualReader = localReaderFactory?.forContext(resolvedContext) ?: reader
            val response = actualReader.fetchConfigMapData(cmName, validatedNamespace)
            ResponseEntity.ok(response)
        } catch (error: Exception) {
            invalidateOnAuthError(error, resolvedContext, localReaderFactory)
            if (isAwsSsoAuthError(error) || isKubeUnauthorized(error)) {
                logger.warn { "Failed to fetch configmap-data-local (auth): ${friendlyLocalServiceListErrorMessage(error)}" }
            } else {
                logger.error(error) { "Failed to fetch configmap-data-local for $cmName" }
            }
            ResponseEntity
                .status(localErrorStatus(error))
                .body(ErrorResponse("Failed to fetch ConfigMap data: ${friendlyLocalServiceListErrorMessage(error)}"))
        }
    }

    @GetMapping("/secret-keys")
    fun secretKeys(@RequestParam(required = false) name: String?): ResponseEntity<*> {
        val secretName = name?.trim().orEmpty()
        if (secretName.isBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required query param: name"))
        }
        return try {
            val response = serviceReader.fetchSecretKeys(secretName, appConfig.inClusterNamespace)
            ResponseEntity.ok(response)
        } catch (error: Exception) {
            logger.error(error) { "Failed to fetch secret-keys for $secretName" }
            ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse("Failed to fetch Secret keys: ${sanitizeErrorMessage(error.message)}"))
        }
    }

    @GetMapping("/secret-keys-local")
    fun secretKeysLocal(
        @RequestParam(required = false) name: String?,
        @RequestParam(required = false) namespace: String?,
        @RequestParam(required = false) context: String?,
    ): ResponseEntity<*> {
        val reader = localServiceReader
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Local mode not enabled"))

        val rawName = name?.trim()
        val rawNamespace = namespace?.trim()
        val rawContext = context?.trim()

        val resolvedContext = if (rawContext.isNullOrBlank()) "" else {
            validateParam(rawContext)
                ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid context parameter"))
        }
        if (rawName.isNullOrBlank() || rawNamespace.isNullOrBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required query params: name, namespace"))
        }
        val secretName = validateParam(rawName)
            ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid name parameter"))
        val validatedNamespace = validateParam(rawNamespace)
            ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid namespace parameter"))

        return try {
            val actualReader = localReaderFactory?.forContext(resolvedContext) ?: reader
            val response = actualReader.fetchSecretKeys(secretName, validatedNamespace)
            ResponseEntity.ok(response)
        } catch (error: Exception) {
            invalidateOnAuthError(error, resolvedContext, localReaderFactory)
            if (isAwsSsoAuthError(error) || isKubeUnauthorized(error)) {
                logger.warn { "Failed to fetch secret-keys-local (auth): ${friendlyLocalServiceListErrorMessage(error)}" }
            } else {
                logger.error(error) { "Failed to fetch secret-keys-local for $secretName" }
            }
            ResponseEntity
                .status(localErrorStatus(error))
                .body(ErrorResponse("Failed to fetch Secret keys: ${friendlyLocalServiceListErrorMessage(error)}"))
        }
    }

    @GetMapping("/secret-value")
    fun secretValue(
        @RequestParam(required = false) name: String?,
        @RequestParam(required = false) key: String?,
    ): ResponseEntity<*> {
        val secretName = name?.trim().orEmpty()
        val secretKey = key?.trim().orEmpty()
        if (secretName.isBlank() || secretKey.isBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required query params: name, key"))
        }
        return try {
            val response = serviceReader.fetchSecretValue(secretName, appConfig.inClusterNamespace, secretKey)
            ResponseEntity.ok(response)
        } catch (error: Exception) {
            logger.error(error) { "Failed to fetch secret-value for $secretName/$secretKey" }
            ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse("Failed to fetch Secret value: ${sanitizeErrorMessage(error.message)}"))
        }
    }

    @GetMapping("/secret-value-local")
    fun secretValueLocal(
        @RequestParam(required = false) name: String?,
        @RequestParam(required = false) key: String?,
        @RequestParam(required = false) namespace: String?,
        @RequestParam(required = false) context: String?,
    ): ResponseEntity<*> {
        val reader = localServiceReader
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Local mode not enabled"))

        val rawSecretName = name?.trim()
        val rawKey = key?.trim()
        val rawNamespace = namespace?.trim()
        val rawContext = context?.trim()

        val resolvedContext = if (rawContext.isNullOrBlank()) "" else {
            validateParam(rawContext)
                ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid context parameter"))
        }
        if (rawSecretName.isNullOrBlank() || rawKey.isNullOrBlank() || rawNamespace.isNullOrBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required query params: name, key, namespace"))
        }
        val secretName = validateParam(rawSecretName)
            ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid name parameter"))
        val validatedNamespace = validateParam(rawNamespace)
            ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid namespace parameter"))
        val validatedKey = validateParam(rawKey)
            ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid key parameter"))

        return try {
            val actualReader = localReaderFactory?.forContext(resolvedContext) ?: reader
            val response = actualReader.fetchSecretValue(secretName, validatedNamespace, validatedKey)
            ResponseEntity.ok(response)
        } catch (error: Exception) {
            invalidateOnAuthError(error, resolvedContext, localReaderFactory)
            if (isAwsSsoAuthError(error) || isKubeUnauthorized(error)) {
                logger.warn { "Failed to fetch secret-value-local (auth): ${friendlyLocalServiceListErrorMessage(error)}" }
            } else {
                logger.error(error) { "Failed to fetch secret-value-local for $secretName/$rawKey" }
            }
            ResponseEntity
                .status(localErrorStatus(error))
                .body(ErrorResponse("Failed to fetch Secret value: ${friendlyLocalServiceListErrorMessage(error)}"))
        }
    }

    @GetMapping("/service-endpoints")
    fun serviceEndpoints(
        @RequestParam(required = false) service: String?,
        @RequestParam(required = false) namespace: String?,
    ): ResponseEntity<*> {
        val serviceName = service?.trim().orEmpty()
        if (serviceName.isBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required query param: service"))
        }
        return try {
            val ns = namespace?.trim()?.ifBlank { null } ?: serviceReader.resolveCurrentNamespace()
            val response = serviceReader.fetchServiceEndpoints(serviceName, ns)
            ResponseEntity.ok(response)
        } catch (error: Exception) {
            logger.error(error) { "Failed to fetch service endpoints for $serviceName" }
            ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse("Failed to fetch service endpoints: ${sanitizeErrorMessage(error.message)}"))
        }
    }

    @GetMapping("/service-endpoints-local")
    fun serviceEndpointsLocal(
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
            val response = actualReader.fetchServiceEndpoints(serviceName, validatedNamespace)
            ResponseEntity.ok(response)
        } catch (error: Exception) {
            invalidateOnAuthError(error, resolvedContext, localReaderFactory)
            if (isAwsSsoAuthError(error) || isKubeUnauthorized(error)) {
                logger.warn { "Failed to fetch service-endpoints-local (auth): ${friendlyLocalServiceListErrorMessage(error)}" }
            } else {
                logger.error(error) { "Failed to fetch service-endpoints-local for $serviceName" }
            }
            ResponseEntity
                .status(localErrorStatus(error))
                .body(ErrorResponse("Failed to fetch service endpoints: ${friendlyLocalServiceListErrorMessage(error)}"))
        }
    }
}
