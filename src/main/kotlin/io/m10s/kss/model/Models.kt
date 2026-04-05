package io.m10s.kss.model

data class ServiceSummaryResponse(val services: List<ServiceSummary>)

data class ServiceSummary(
    val serviceName: String,
    val namespace: String = "",
    val podCount: Int,
    val readyCount: Int,
    val restartCount: Int,
    val cpuUsageMilliCores: Long? = null,
    val memoryUsageBytes: Long? = null,
    val cpuRequestMilliCores: Long? = null,
    val memoryRequestBytes: Long? = null,
    val cpuLimitMilliCores: Long? = null,
    val memoryLimitBytes: Long? = null,
    val version: String? = null,
    val deployedAtEpochSeconds: Long? = null,
    val hpaMinReplicas: Int? = null,
    val hpaMaxReplicas: Int? = null,
    val hpaCurrentReplicas: Int? = null,
    val hpaDesiredReplicas: Int? = null,
    val restartReasons: Map<String, Int>? = null,
)

data class PodResourceDetailsResponse(
    val serviceName: String,
    val namespace: String,
    val pods: List<PodResourceDetails>,
)

data class PodResourceDetails(
    val podName: String,
    val ready: String? = null,
    val status: String? = null,
    val restarts: Int? = null,
    val podIp: String? = null,
    val nodeName: String? = null,
    val createdAtEpochSeconds: Long? = null,
    val cpuUsageMilliCores: Long? = null,
    val memoryUsageBytes: Long? = null,
    val cpuRequestMilliCores: Long? = null,
    val memoryRequestBytes: Long? = null,
    val cpuLimitMilliCores: Long? = null,
    val memoryLimitBytes: Long? = null,
    val restartReasons: Map<String, Int>? = null,
)

data class ErrorResponse(val message: String)

data class DeploymentRevision(
    val revision: Int,
    val image: String,
    val createdAtEpochSeconds: Long,
    val isCurrent: Boolean,
)

data class DeploymentHistoryResponse(
    val deploymentName: String,
    val namespace: String,
    val currentRevision: Int,
    val revisions: List<DeploymentRevision>,
)

data class RollbackRequest(
    val deploymentName: String,
    val namespace: String,
    val targetRevision: Int? = null,
)

data class RollbackResponse(
    val success: Boolean,
    val message: String,
    val targetRevision: Int? = null,
)

data class RestartRequest(
    val serviceName: String,
    val namespace: String,
)

data class RestartResponse(
    val success: Boolean,
    val message: String,
    val deployment: String? = null,
    val namespace: String? = null,
)

data class ServiceEndpoint(
    val ip: String,
    val port: Int,
    val podName: String?,
    val ready: Boolean,
)

data class IngressRule(
    val host: String?,
    val path: String?,
    val backend: String,
    val address: String?,
)

data class ServicePort(
    val name: String?,
    val port: Int,
    val targetPort: String?,
    val protocol: String,
)

data class ServiceEndpointsResponse(
    val serviceName: String,
    val namespace: String,
    val serviceType: String?,
    val clusterIP: String?,
    val ports: List<ServicePort>,
    val endpoints: List<ServiceEndpoint>,
    val ingresses: List<IngressRule>,
)

data class PodEvent(
    val type: String?,
    val reason: String?,
    val message: String?,
    val count: Int?,
    val firstTimestamp: Long?,
    val lastTimestamp: Long?,
    val source: String?,
    val podName: String? = null,
)

data class PodEventsResponse(
    val podName: String,
    val namespace: String,
    val events: List<PodEvent>,
)

data class ServiceEventsResponse(
    val serviceName: String,
    val namespace: String,
    val events: List<PodEvent>,
)

data class PodLogsResponse(
    val podName: String,
    val containerName: String,
    val namespace: String,
    val logs: String,
    val lineCount: Int,
    val truncated: Boolean,
)

data class ConfigReference(
    val name: String,
    val type: String,
    val mountPath: String?,
    val keys: List<String>,
    val optional: Boolean,
)

data class ConfigMapData(
    val name: String,
    val namespace: String,
    val data: Map<String, String>,
)

data class SecretData(
    val name: String,
    val namespace: String,
    val keys: List<String>,
)

data class SecretValueResponse(
    val key: String,
    val encodedValue: String,
)

data class ServiceConfigsResponse(
    val serviceName: String,
    val namespace: String,
    val configMaps: List<ConfigReference>,
    val secrets: List<ConfigReference>,
)

data class ScaleRequest(
    val deploymentName: String,
    val namespace: String,
    val replicas: Int,
    val scaleHpa: Boolean = false,
    val hpaMaxReplicas: Int? = null,
)

data class ScaleResponse(
    val success: Boolean,
    val message: String,
    val deploymentName: String,
    val namespace: String,
    val previousReplicas: Int?,
    val newReplicas: Int,
    val scaledVia: String = "deployment",
    val hpaName: String? = null,
)
