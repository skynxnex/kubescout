package io.m10s.kubescout.routes

import io.m10s.kubescout.config.AppConfig
import io.m10s.kubescout.k8s.K8sServiceReader
import io.m10s.kubescout.k8s.K8sServiceReaderFactory
import io.m10s.kubescout.model.ErrorResponse
import io.m10s.kubescout.model.RestartRequest
import io.m10s.kubescout.model.RestartResponse
import io.m10s.kubescout.model.RollbackRequest
import io.m10s.kubescout.model.RollbackResponse
import io.m10s.kubescout.model.ScaleRequest
import io.m10s.kubescout.model.ScaleResponse
import mu.KotlinLogging
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

private val logger = KotlinLogging.logger {}

@RestController
class DeploymentController(
    private val appConfig: AppConfig,
    private val serviceReader: K8sServiceReader,
    private val localServiceReader: K8sServiceReader?,
    private val localReaderFactory: K8sServiceReaderFactory?,
) {

    @GetMapping("/deployment-history")
    fun deploymentHistory(@RequestParam(required = false) deployment: String?): ResponseEntity<*> {
        val deploymentName = deployment?.trim().orEmpty()
        if (deploymentName.isBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required param: deployment"))
        }
        return try {
            val history = serviceReader.fetchDeploymentHistory(deploymentName, appConfig.inClusterNamespace)
            ResponseEntity.ok(history)
        } catch (error: Exception) {
            logger.error(error) { "Failed to fetch deployment history for $deploymentName" }
            val errorMsg = when {
                error.message?.contains("401") == true || error.message?.contains("Unauthorized") == true ->
                    "Unauthorized: ${sanitizeErrorMessage(error.message)}"
                else -> "Failed to fetch deployment history: ${sanitizeErrorMessage(error.message)}"
            }
            ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse(errorMsg))
        }
    }

    @GetMapping("/deployment-history-local")
    fun deploymentHistoryLocal(
        @RequestParam(required = false) deployment: String?,
        @RequestParam(required = false) namespace: String?,
        @RequestParam(required = false) context: String?,
    ): ResponseEntity<*> {
        val reader = localServiceReader
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Local mode not enabled"))

        val rawDeploymentName = deployment?.trim()
        val rawNamespace = namespace?.trim()
        val rawContext = context?.trim()

        val resolvedContext = if (rawContext.isNullOrBlank()) "" else {
            validateParam(rawContext)
                ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid context parameter"))
        }
        if (rawDeploymentName.isNullOrBlank() || rawNamespace.isNullOrBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required params: deployment, namespace"))
        }
        val deploymentName = validateParam(rawDeploymentName)
            ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid deployment parameter"))
        val validatedNamespace = validateParam(rawNamespace)
            ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid namespace parameter"))

        return try {
            val actualReader = localReaderFactory?.forContext(resolvedContext) ?: reader
            val history = actualReader.fetchDeploymentHistory(deploymentName, validatedNamespace)
            ResponseEntity.ok(history)
        } catch (error: Exception) {
            invalidateOnAuthError(error, resolvedContext, localReaderFactory)
            val status = localErrorStatus(error)
            val message = friendlyLocalServiceListErrorMessage(error)
            ResponseEntity.status(status).body(ErrorResponse(message))
        }
    }

    @PostMapping("/rollback-deployment")
    fun rollbackDeployment(
        @RequestHeader("X-Requested-By", required = false) requestedBy: String?,
        @RequestBody request: RollbackRequest,
    ): ResponseEntity<*> {
        if (!checkCsrfHeader(requestedBy)) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required header: X-Requested-By"))
        }
        if (request.deploymentName.isBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required field: deploymentName"))
        }
        if (!SAFE_PARAM_REGEX.matches(request.deploymentName)) {
            return ResponseEntity.badRequest().body(ErrorResponse("Invalid deploymentName field"))
        }
        return try {
            val response = serviceReader.rollbackDeployment(request.deploymentName, appConfig.inClusterNamespace, request.targetRevision)
            ResponseEntity.ok(response)
        } catch (error: Exception) {
            logger.error(error) { "Rollback failed" }
            ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(RollbackResponse(success = false, message = "Rollback failed: ${sanitizeErrorMessage(error.message)}"))
        }
    }

    @PostMapping("/rollback-deployment-local")
    fun rollbackDeploymentLocal(
        @RequestHeader("X-Requested-By", required = false) requestedBy: String?,
        @RequestBody request: RollbackRequest,
        @RequestParam(required = false) context: String?,
    ): ResponseEntity<*> {
        if (!checkCsrfHeader(requestedBy)) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required header: X-Requested-By"))
        }
        val reader = localServiceReader
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Local mode not enabled"))

        val rawContext = context?.trim()
        val resolvedContext = if (rawContext.isNullOrBlank()) "" else {
            validateParam(rawContext)
                ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid context parameter"))
        }
        if (request.deploymentName.isBlank() || request.namespace.isBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required fields: deploymentName, namespace"))
        }
        if (!SAFE_PARAM_REGEX.matches(request.deploymentName)) {
            return ResponseEntity.badRequest().body(ErrorResponse("Invalid deploymentName field"))
        }
        if (!SAFE_PARAM_REGEX.matches(request.namespace)) {
            return ResponseEntity.badRequest().body(ErrorResponse("Invalid namespace field"))
        }
        return try {
            val actualReader = localReaderFactory?.forContext(resolvedContext) ?: reader
            val response = actualReader.rollbackDeployment(request.deploymentName, request.namespace, request.targetRevision)
            ResponseEntity.ok(response)
        } catch (error: Exception) {
            invalidateOnAuthError(error, resolvedContext, localReaderFactory)
            logger.error(error) { "Rollback failed" }
            ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(RollbackResponse(success = false, message = "Rollback failed: ${sanitizeErrorMessage(error.message)}"))
        }
    }

    @PostMapping("/restart-deployment")
    fun restartDeployment(
        @RequestHeader("X-Requested-By", required = false) requestedBy: String?,
        @RequestBody request: RestartRequest,
    ): ResponseEntity<*> {
        if (!checkCsrfHeader(requestedBy)) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required header: X-Requested-By"))
        }
        if (request.serviceName.isBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required field: serviceName"))
        }
        if (!SAFE_PARAM_REGEX.matches(request.serviceName)) {
            return ResponseEntity.badRequest().body(ErrorResponse("Invalid serviceName field"))
        }
        return try {
            val response = serviceReader.restartDeployment(request.serviceName, appConfig.inClusterNamespace)
            ResponseEntity.ok(response)
        } catch (error: Exception) {
            logger.error(error) { "Restart failed" }
            ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(RestartResponse(success = false, message = "Restart failed: ${sanitizeErrorMessage(error.message)}"))
        }
    }

    @PostMapping("/restart-deployment-local")
    fun restartDeploymentLocal(
        @RequestHeader("X-Requested-By", required = false) requestedBy: String?,
        @RequestBody request: RestartRequest,
        @RequestParam(required = false) context: String?,
    ): ResponseEntity<*> {
        if (!checkCsrfHeader(requestedBy)) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required header: X-Requested-By"))
        }
        val reader = localServiceReader
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Local mode not enabled"))

        val rawContext = context?.trim()
        val resolvedContext = if (rawContext.isNullOrBlank()) "" else {
            validateParam(rawContext)
                ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid context parameter"))
        }
        if (request.serviceName.isBlank() || request.namespace.isBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required fields: serviceName, namespace"))
        }
        if (!SAFE_PARAM_REGEX.matches(request.serviceName)) {
            return ResponseEntity.badRequest().body(ErrorResponse("Invalid serviceName field"))
        }
        if (!SAFE_PARAM_REGEX.matches(request.namespace)) {
            return ResponseEntity.badRequest().body(ErrorResponse("Invalid namespace field"))
        }
        return try {
            val actualReader = localReaderFactory?.forContext(resolvedContext) ?: reader
            val response = actualReader.restartDeployment(request.serviceName, request.namespace)
            ResponseEntity.ok(response)
        } catch (error: Exception) {
            invalidateOnAuthError(error, resolvedContext, localReaderFactory)
            logger.error(error) { "Restart failed" }
            ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(RestartResponse(success = false, message = "Restart failed: ${sanitizeErrorMessage(error.message)}"))
        }
    }

    @PostMapping("/scale-deployment")
    fun scaleDeployment(
        @RequestHeader("X-Requested-By", required = false) requestedBy: String?,
        @RequestBody request: ScaleRequest,
    ): ResponseEntity<*> {
        if (!checkCsrfHeader(requestedBy)) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required header: X-Requested-By"))
        }
        if (request.deploymentName.isBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required field: deploymentName"))
        }
        if (!SAFE_PARAM_REGEX.matches(request.deploymentName)) {
            return ResponseEntity.badRequest().body(ErrorResponse("Invalid deploymentName field"))
        }
        return try {
            val response = if (request.scaleHpa) {
                serviceReader.scaleHpa(
                    deploymentName = request.deploymentName,
                    namespace = appConfig.inClusterNamespace,
                    minReplicas = request.replicas,
                    maxReplicas = request.hpaMaxReplicas,
                )
            } else {
                serviceReader.scaleDeployment(request.deploymentName, appConfig.inClusterNamespace, request.replicas)
            }
            if (!response.success) {
                ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response)
            } else {
                ResponseEntity.ok(response)
            }
        } catch (error: Exception) {
            logger.error(error) { "Scale deployment failed" }
            ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ScaleResponse(
                    success = false,
                    message = "Scale failed: ${sanitizeErrorMessage(error.message)}",
                    deploymentName = "",
                    namespace = "",
                    previousReplicas = null,
                    newReplicas = 0,
                ))
        }
    }

    @PostMapping("/scale-deployment-local")
    fun scaleDeploymentLocal(
        @RequestHeader("X-Requested-By", required = false) requestedBy: String?,
        @RequestBody request: ScaleRequest,
        @RequestParam(required = false) context: String?,
    ): ResponseEntity<*> {
        if (!checkCsrfHeader(requestedBy)) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required header: X-Requested-By"))
        }
        val reader = localServiceReader
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Local mode not enabled"))

        val rawContext = context?.trim()
        val resolvedContext = if (rawContext.isNullOrBlank()) "" else {
            validateParam(rawContext)
                ?: return ResponseEntity.badRequest().body(ErrorResponse("Invalid context parameter"))
        }
        if (request.deploymentName.isBlank() || request.namespace.isBlank()) {
            return ResponseEntity.badRequest().body(ErrorResponse("Missing required fields: deploymentName, namespace"))
        }
        if (!SAFE_PARAM_REGEX.matches(request.deploymentName)) {
            return ResponseEntity.badRequest().body(ErrorResponse("Invalid deploymentName field"))
        }
        if (!SAFE_PARAM_REGEX.matches(request.namespace)) {
            return ResponseEntity.badRequest().body(ErrorResponse("Invalid namespace field"))
        }
        return try {
            val actualReader = localReaderFactory?.forContext(resolvedContext) ?: reader
            val response = if (request.scaleHpa) {
                actualReader.scaleHpa(
                    deploymentName = request.deploymentName,
                    namespace = request.namespace,
                    minReplicas = request.replicas,
                    maxReplicas = request.hpaMaxReplicas,
                )
            } else {
                actualReader.scaleDeployment(request.deploymentName, request.namespace, request.replicas)
            }
            if (!response.success) {
                ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response)
            } else {
                ResponseEntity.ok(response)
            }
        } catch (error: Exception) {
            invalidateOnAuthError(error, resolvedContext, localReaderFactory)
            if (isAwsSsoAuthError(error) || isKubeUnauthorized(error)) {
                logger.warn { "Failed to scale-deployment-local (auth): ${friendlyLocalServiceListErrorMessage(error)}" }
            } else {
                logger.error(error) { "Scale deployment failed" }
            }
            ResponseEntity
                .status(localErrorStatus(error))
                .body(ScaleResponse(
                    success = false,
                    message = "Scale failed: ${friendlyLocalServiceListErrorMessage(error)}",
                    deploymentName = "",
                    namespace = "",
                    previousReplicas = null,
                    newReplicas = 0,
                ))
        }
    }
}
