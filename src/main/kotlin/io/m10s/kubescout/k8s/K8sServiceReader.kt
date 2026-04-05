package io.m10s.kubescout.k8s

import io.kubernetes.client.openapi.ApiException
import io.kubernetes.client.openapi.apis.CustomObjectsApi
import io.kubernetes.client.openapi.apis.AppsV1Api
import io.kubernetes.client.openapi.apis.CoreV1Api
import io.kubernetes.client.openapi.apis.AutoscalingV1Api
import io.kubernetes.client.openapi.apis.AutoscalingV2Api
import io.kubernetes.client.custom.Quantity
import io.kubernetes.client.openapi.models.V2HorizontalPodAutoscaler
import io.kubernetes.client.openapi.models.V1Pod
import io.kubernetes.client.openapi.models.V1ReplicaSet
import io.kubernetes.client.openapi.models.V1Service
import io.kubernetes.client.util.ClientBuilder
import io.kubernetes.client.util.KubeConfig
import org.yaml.snakeyaml.Yaml
import org.slf4j.LoggerFactory
import io.m10s.kubescout.model.PodResourceDetails
import java.io.FileReader
import java.time.OffsetDateTime

private fun parseDeployEpochSecondsFromVersion(value: String?): Long? {
    if (value.isNullOrBlank()) return null
    // Expected format (examples):
    //   b828a7dd0120730c423cad3b1c063b418ad041f6_1769600283
    //   1769600283
    val trimmed = value.trim()
    val lastPart = trimmed.substringAfterLast('_', trimmed)
    return lastPart.toLongOrNull()
}

private fun readEnvVarFromPod(pod: V1Pod, key: String): String? {
    val containers = pod.spec?.containers ?: return null
    return containers
        .asSequence()
        .flatMap { (it.env ?: emptyList()).asSequence() }
        .firstOrNull { it.name == key }
        ?.value
}

private fun resolveVersionFromPod(pod: V1Pod): String? {
    // Prefer explicit VERSION/FIAAS_VERSION env vars if present.
    val version = readEnvVarFromPod(pod, "VERSION")
        ?: readEnvVarFromPod(pod, "FIAAS_VERSION")
        ?: readEnvVarFromPod(pod, "FIAAS_IMAGE")
        ?: readEnvVarFromPod(pod, "IMAGE")

    if (version != null) return version

    // Fallback: read image tag from first container image.
    val image = pod.spec?.containers?.firstOrNull()?.image
    return image
}

private fun replicaSetNameForPod(pod: V1Pod): String? {
    // Typical chain: Pod -> ReplicaSet -> Deployment
    return pod.metadata?.ownerReferences
        ?.firstOrNull { it.kind == "ReplicaSet" }
        ?.name
}

private fun epochSecondsFromOffsetDateTime(value: OffsetDateTime?): Long? {
    return value?.toEpochSecond()
}

private fun addReason(acc: MutableMap<String, Int>, key: String, count: Int = 1) {
    if (key.isBlank()) return
    acc[key] = (acc[key] ?: 0) + count
}

private fun collectRestartReasons(pods: List<V1Pod>): Map<String, Int>? {
    val reasons = mutableMapOf<String, Int>()

    pods.forEach { pod ->
        val statuses = pod.status?.containerStatuses ?: return@forEach
        statuses.forEach { st ->
            val restartCount = st.restartCount ?: 0
            if (restartCount <= 0) return@forEach

            // Prefer termination reason in lastState (most accurate for why it restarted)
            val terminated = st.lastState?.terminated
            val waiting = st.state?.waiting

            val reason = when {
                terminated?.reason != null -> terminated.reason
                terminated?.signal != null -> "Signal:${terminated.signal}"
                terminated?.exitCode != null -> "ExitCode:${terminated.exitCode}"
                waiting?.reason != null -> waiting.reason
                else -> "Unknown"
            } ?: "Unknown"

            // We can't reliably distribute multiple restarts across multiple reasons without events;
            // so we attribute all restarts for this container to its last known reason.
            addReason(reasons, reason, restartCount)
        }
    }

    return reasons.takeIf { it.isNotEmpty() }
}

private fun collectRestartReasonsForPod(pod: V1Pod): Map<String, Int>? =
    collectRestartReasons(listOf(pod))

private fun quantityFromAny(value: Any?): Quantity? {
    return when (value) {
        null -> null
        is Quantity -> value
        is String -> runCatching { Quantity.fromString(value.trim()) }.getOrNull()
        else -> runCatching { Quantity.fromString(value.toString().trim()) }.getOrNull()
    }
}

private fun parseCpuToMilliCores(value: Any?): Long? {
    val q = quantityFromAny(value) ?: return null
    // Quantity.getNumber for CPU ends up in cores for decimal SI (e.g. 220m => 0.220)
    return runCatching {
        q.number.multiply(java.math.BigDecimal(1000)).toLong()
    }.getOrNull()
}

private fun parseMemoryToBytes(value: Any?): Long? {
    val q = quantityFromAny(value) ?: return null
    // Quantity.getNumber for memory ends up in bytes (e.g. 2Gi => 2147483648)
    return runCatching { q.number.toLong() }.getOrNull()
}

private data class ResourceTotals(
    val cpuRequestMilli: Long? = null,
    val memRequestBytes: Long? = null,
    val cpuLimitMilli: Long? = null,
    val memLimitBytes: Long? = null,
)

private fun sumResourcesFromPodSpec(pods: List<V1Pod>): ResourceTotals {
    var cpuReqSum = 0L
    var memReqSum = 0L
    var cpuLimSum = 0L
    var memLimSum = 0L
    var anyCpuReq = false
    var anyMemReq = false
    var anyCpuLim = false
    var anyMemLim = false

    pods.forEach { pod ->
        val containers = pod.spec?.containers ?: return@forEach
        containers.forEach { c ->
            val res = c.resources
            val req = res?.requests
            val lim = res?.limits
            val cpuReq = parseCpuToMilliCores(req?.get("cpu"))
            val memReq = parseMemoryToBytes(req?.get("memory"))
            val cpuLim = parseCpuToMilliCores(lim?.get("cpu"))
            val memLim = parseMemoryToBytes(lim?.get("memory"))

            if (cpuReq != null) { anyCpuReq = true; cpuReqSum += cpuReq }
            if (memReq != null) { anyMemReq = true; memReqSum += memReq }
            if (cpuLim != null) { anyCpuLim = true; cpuLimSum += cpuLim }
            if (memLim != null) { anyMemLim = true; memLimSum += memLim }
        }
    }

    return ResourceTotals(
        cpuRequestMilli = cpuReqSum.takeIf { anyCpuReq },
        memRequestBytes = memReqSum.takeIf { anyMemReq },
        cpuLimitMilli = cpuLimSum.takeIf { anyCpuLim },
        memLimitBytes = memLimSum.takeIf { anyMemLim },
    )
}

private fun sumResourcesFromSinglePodSpec(pod: V1Pod): ResourceTotals =
    sumResourcesFromPodSpec(listOf(pod))

private fun readySummaryForPod(pod: V1Pod): String? {
    val statuses = pod.status?.containerStatuses ?: return null
    if (statuses.isEmpty()) return null
    val ready = statuses.count { it.ready == true }
    return "$ready/${statuses.size}"
}

private fun restartsForPod(pod: V1Pod): Int? {
    val statuses = pod.status?.containerStatuses ?: return null
    return statuses.sumOf { it.restartCount ?: 0 }
}

private data class UsageTotals(
    val cpuUsageMilli: Long? = null,
    val memUsageBytes: Long? = null,
)

private fun getNamespacePodUsageFromMetricsApi(
    customObjectsApi: CustomObjectsApi,
    namespace: String,
): Map<String, UsageTotals> {
    return try {
        val obj = customObjectsApi
            .listNamespacedCustomObject(
                "metrics.k8s.io",
                "v1beta1",
                namespace,
                "pods",
            )
            .execute()

        @Suppress("UNCHECKED_CAST")
        val map = obj as? Map<String, Any?> ?: return emptyMap()
        @Suppress("UNCHECKED_CAST")
        val items = map["items"] as? List<Map<String, Any?>> ?: return emptyMap()

        val out = mutableMapOf<String, UsageTotals>()
        items.forEach { item ->
            val meta = item["metadata"] as? Map<String, Any?>
            val name = meta?.get("name")?.toString() ?: return@forEach
            @Suppress("UNCHECKED_CAST")
            val containers = item["containers"] as? List<Map<String, Any?>> ?: emptyList()
            var cpuSum = 0L
            var memSum = 0L
            var anyCpu = false
            var anyMem = false
            containers.forEach { c ->
                val usage = c["usage"] as? Map<String, Any?> ?: emptyMap()
                val cpu = parseCpuToMilliCores(usage["cpu"])
                val mem = parseMemoryToBytes(usage["memory"])
                if (cpu != null) { anyCpu = true; cpuSum += cpu }
                if (mem != null) { anyMem = true; memSum += mem }
            }
            out[name] = UsageTotals(
                cpuUsageMilli = cpuSum.takeIf { anyCpu },
                memUsageBytes = memSum.takeIf { anyMem },
            )
        }
        out
    } catch (_: Exception) {
        // metrics-server is often not installed or RBAC is missing; treat as optional.
        emptyMap()
    }
}

private fun sumUsageFromPodUsageMap(podNames: List<String>, podUsage: Map<String, UsageTotals>): UsageTotals {
    if (podNames.isEmpty()) return UsageTotals(null, null)
    var cpuSum = 0L
    var memSum = 0L
    var anyCpu = false
    var anyMem = false
    podNames.forEach { name ->
        val u = podUsage[name] ?: return@forEach
        val cpu = u.cpuUsageMilli
        val mem = u.memUsageBytes
        if (cpu != null) { anyCpu = true; cpuSum += cpu }
        if (mem != null) { anyMem = true; memSum += mem }
    }
    return UsageTotals(
        cpuUsageMilli = cpuSum.takeIf { anyCpu },
        memUsageBytes = memSum.takeIf { anyMem },
    )
}

class K8sServiceReader(
    private val clientProvider: () -> io.kubernetes.client.openapi.ApiClient,
    private val maxReplicas: Int = 50,
) {
    // Cache for metrics API results (10 second TTL to reduce load on metrics-server)
    private val metricsCache = MetricsCache<String, Map<String, UsageTotals>>(ttlMillis = 10_000)

    private val client: io.kubernetes.client.openapi.ApiClient by lazy { clientProvider() }

    private val coreApi: CoreV1Api by lazy { CoreV1Api(client) }

    private val appsApi: AppsV1Api by lazy { AppsV1Api(client) }

    private val customObjectsApi: CustomObjectsApi by lazy { CustomObjectsApi(client) }

    private val autoscalingV2Api: AutoscalingV2Api by lazy { AutoscalingV2Api(client) }

    // Fallback for older clusters where v2 isn't enabled
    private val autoscalingV1Api: AutoscalingV1Api by lazy { AutoscalingV1Api(client) }

    /**
     * Cached wrapper for getNamespacePodUsageFromMetricsApi.
     * Results are cached for 10 seconds to reduce load on the metrics-server.
     */
    private fun getCachedPodUsage(namespace: String): Map<String, UsageTotals> {
        return metricsCache.getOrCompute(namespace) {
            getNamespacePodUsageFromMetricsApi(customObjectsApi, namespace)
        }
    }

    // ── Label-selector helpers ────────────────────────────────────────────────

    private fun buildLabelSelector(selector: Map<String, String>): String =
        selector.entries.joinToString(",") { (k, v) -> "$k=$v" }

    private fun fetchPodsForSelector(namespace: String, labelSelector: String): List<V1Pod> =
        if (labelSelector.isBlank()) emptyList()
        else coreApi.listNamespacedPod(namespace).labelSelector(labelSelector).execute().items

    // ─────────────────────────────────────────────────────────────────────────

    private data class HpaInfo(
        val minReplicas: Int? = null,
        val maxReplicas: Int? = null,
        val currentReplicas: Int? = null,
        val desiredReplicas: Int? = null,
    )

    private fun listHpasByTargetName(namespace: String): Map<String, HpaInfo> {
        fun fromV2(items: List<V2HorizontalPodAutoscaler>): Map<String, HpaInfo> {
            val out = mutableMapOf<String, HpaInfo>()
            items.forEach { hpa ->
                val targetName = hpa.spec?.scaleTargetRef?.name ?: return@forEach
                out[targetName] = HpaInfo(
                    minReplicas = hpa.spec?.minReplicas,
                    maxReplicas = hpa.spec?.maxReplicas,
                    currentReplicas = hpa.status?.currentReplicas,
                    desiredReplicas = hpa.status?.desiredReplicas,
                )
            }
            return out
        }

        return try {
            val items = autoscalingV2Api.listNamespacedHorizontalPodAutoscaler(namespace)
                .execute()
                .items
            fromV2(items)
        } catch (_: Exception) {
            // v2 may not be enabled or RBAC missing
            try {
                val items = autoscalingV1Api.listNamespacedHorizontalPodAutoscaler(namespace)
                    .execute()
                    .items

                val out = mutableMapOf<String, HpaInfo>()
                items.forEach { hpa ->
                    val targetName = hpa.spec?.scaleTargetRef?.name ?: return@forEach
                    out[targetName] = HpaInfo(
                        minReplicas = hpa.spec?.minReplicas,
                        maxReplicas = hpa.spec?.maxReplicas,
                        currentReplicas = hpa.status?.currentReplicas,
                        desiredReplicas = hpa.status?.desiredReplicas,
                    )
                }
                out
            } catch (_: Exception) {
                emptyMap()
            }
        }
    }

    companion object {
        private val logger = LoggerFactory.getLogger(K8sServiceReader::class.java)

        // Compiled once at class-load time and reused across all calls to fetchDeploymentHistory.
        private val TAG_PATTERN_REGEX = Regex("""[:@]([^:\s@]+)""")

        private val AWS_AUTH_KEYWORDS = listOf(
            "aws sso",
            "expiredtoken",
            "accessdenied",
            "unable to load aws credentials",
            "security token",
        )

        fun fromCluster(maxReplicas: Int = 50): K8sServiceReader {
            return K8sServiceReader({ io.kubernetes.client.util.Config.fromCluster() }, maxReplicas)
        }

        fun fromKubeConfig(context: String, maxReplicas: Int = 50): K8sServiceReader {
            return K8sServiceReader({
                val kubeConfigPath = System.getenv("KUBECONFIG")
                    ?: (System.getProperty("user.home") + "/.kube/config")
                // Replace localhost/127.0.0.1 with host.docker.internal so API calls
                // from inside Docker reach the host machine's Kubernetes API server.
                val rawConfig = java.io.File(kubeConfigPath).readText()
                    .replace("https://127.0.0.1:", "https://host.docker.internal:")
                    .replace("https://localhost:", "https://host.docker.internal:")
                val kubeConfig = KubeConfig.loadKubeConfig(java.io.StringReader(rawConfig))
                if (context.isNotBlank()) {
                    val ok = kubeConfig.setContext(context)
                    if (!ok) {
                        throw IllegalArgumentException("Unknown kube context: $context")
                    }
                }
                ClientBuilder.kubeconfig(kubeConfig).build()
            }, maxReplicas)
        }
    }

    fun resolveCurrentNamespace(): String {
        val namespacePath = java.nio.file.Paths.get(
            "/var/run/secrets/kubernetes.io/serviceaccount/namespace"
        )
        return java.nio.file.Files.readAllBytes(namespacePath)
            .toString(Charsets.UTF_8)
            .trim()
    }

    fun fetchServiceSummaries(
        namePrefixes: List<String>,
        namespaces: List<String> = listOf(resolveCurrentNamespace()),
    ): List<io.m10s.kubescout.model.ServiceSummary> {
        return namespaces.flatMap { namespace ->
            try {
                fetchServiceSummariesForNamespace(namePrefixes, namespace)
            } catch (e: ApiException) {
                if (e.code == 401 || e.code == 403) throw e
                logger.error("Failed to fetch service summaries for namespace=$namespace", e)
                emptyList()
            } catch (e: Exception) {
                val msg = e.message.orEmpty().lowercase()
                if (AWS_AUTH_KEYWORDS.any { msg.contains(it) }) throw e
                logger.error("Failed to fetch service summaries for namespace=$namespace", e)
                emptyList()
            }
        }
    }

    private fun fetchServiceSummariesForNamespace(
        namePrefixes: List<String>,
        namespace: String,
    ): List<io.m10s.kubescout.model.ServiceSummary> {
        val services: List<V1Service> = coreApi.listNamespacedService(namespace)
            .execute()
            .items

        // Optional metrics lookup (one API call per request).
        // If metrics-server isn't installed or RBAC is missing, map is empty.
        val podUsageByName: Map<String, UsageTotals> = getCachedPodUsage(namespace)

        // Optional HPA lookup (one API call per request).
        val hpaByTargetName: Map<String, HpaInfo> = listHpasByTargetName(namespace)

        return services
            .filter { service ->
                val name = service.metadata?.name ?: return@filter false
                namePrefixes.any { prefix -> name.startsWith(prefix) }
            }
            .map { service ->
                val serviceName = service.metadata?.name ?: "unknown"
                val labelSelector = buildLabelSelector(service.spec?.selector ?: emptyMap())
                val pods: List<V1Pod> = fetchPodsForSelector(namespace, labelSelector)

                val resourceTotals = sumResourcesFromPodSpec(pods)
                val podNames = pods.mapNotNull { it.metadata?.name }
                val usageTotals = sumUsageFromPodUsageMap(podNames, podUsageByName)

                val readyCount = pods.count { pod ->
                    pod.status?.conditions?.any { condition ->
                        condition.type == "Ready" && condition.status == "True"
                    } == true
                }
                val restartCount = pods.sumOf { pod ->
                    pod.status?.containerStatuses?.sumOf { it.restartCount ?: 0 } ?: 0
                }

                val restartReasons = collectRestartReasons(pods)

                // Deploy metadata
                // We choose the most recent deploy timestamp among pods (max epoch seconds)
                val versions = pods.mapNotNull { resolveVersionFromPod(it) }
                val deployedAtEpochSeconds = versions
                    .mapNotNull { parseDeployEpochSecondsFromVersion(it) }
                    .maxOrNull()

                // Fallback: if version doesn't contain a timestamp, use the current ReplicaSet creationTimestamp
                // This is a good proxy for last rollout time.
                val replicaSetDeployedAtEpochSeconds: Long? = if (deployedAtEpochSeconds != null) {
                    null
                } else {
                    val replicaSetNames = pods.mapNotNull { replicaSetNameForPod(it) }.distinct()
                    if (replicaSetNames.size == 1) {
                        val rsName = replicaSetNames.first()
                        val rs: V1ReplicaSet? = try {
                            appsApi.listNamespacedReplicaSet(namespace)
                                .fieldSelector("metadata.name=$rsName")
                                .execute()
                                .items
                                .firstOrNull()
                        } catch (_: Exception) {
                            null
                        }
                        epochSecondsFromOffsetDateTime(rs?.metadata?.creationTimestamp)
                    } else {
                        // If pods point to multiple ReplicaSets (during rollout), take max creationTimestamp.
                        replicaSetNames
                            .mapNotNull { rsName ->
                                val rs: V1ReplicaSet? = try {
                                    appsApi.listNamespacedReplicaSet(namespace)
                                        .fieldSelector("metadata.name=$rsName")
                                        .execute()
                                        .items
                                        .firstOrNull()
                                } catch (_: Exception) {
                                    null
                                }
                                epochSecondsFromOffsetDateTime(rs?.metadata?.creationTimestamp)
                            }
                            .maxOrNull()
                    }
                }

                val effectiveDeployedAt = deployedAtEpochSeconds ?: replicaSetDeployedAtEpochSeconds

                val versionForDisplay = if (effectiveDeployedAt != null) {
                    // pick a version that matches the max timestamp (if possible)
                    versions.firstOrNull { parseDeployEpochSecondsFromVersion(it) == deployedAtEpochSeconds }
                        ?: versions.firstOrNull()
                } else {
                    versions.firstOrNull()
                }

                val hpa = hpaByTargetName[serviceName]

                io.m10s.kubescout.model.ServiceSummary(
                    serviceName = serviceName,
                    namespace = namespace,
                    podCount = pods.size,
                    readyCount = readyCount,
                    restartCount = restartCount,
                    cpuUsageMilliCores = usageTotals.cpuUsageMilli,
                    memoryUsageBytes = usageTotals.memUsageBytes,
                    cpuRequestMilliCores = resourceTotals.cpuRequestMilli,
                    memoryRequestBytes = resourceTotals.memRequestBytes,
                    cpuLimitMilliCores = resourceTotals.cpuLimitMilli,
                    memoryLimitBytes = resourceTotals.memLimitBytes,
                    version = versionForDisplay,
                    deployedAtEpochSeconds = effectiveDeployedAt,
                    hpaMinReplicas = hpa?.minReplicas,
                    hpaMaxReplicas = hpa?.maxReplicas,
                    hpaCurrentReplicas = hpa?.currentReplicas,
                    hpaDesiredReplicas = hpa?.desiredReplicas,
                    restartReasons = restartReasons,
                )
            }
    }

    fun fetchPodResourceDetailsForService(
        serviceName: String,
        namespace: String = resolveCurrentNamespace(),
    ): List<PodResourceDetails> {
        val service: V1Service = coreApi.readNamespacedService(serviceName, namespace)
            .execute()

        val labelSelector = buildLabelSelector(service.spec?.selector ?: emptyMap())
        val pods: List<V1Pod> = fetchPodsForSelector(namespace, labelSelector)

        val podUsageByName: Map<String, UsageTotals> = getCachedPodUsage(namespace)

        return pods
            .mapNotNull { pod ->
                val podName = pod.metadata?.name ?: return@mapNotNull null
                val usage = podUsageByName[podName] ?: UsageTotals(null, null)
                val totals = sumResourcesFromSinglePodSpec(pod)
                PodResourceDetails(
                    podName = podName,
                    ready = readySummaryForPod(pod),
                    status = if (pod.metadata?.deletionTimestamp != null) "Terminating" else pod.status?.phase,
                    restarts = restartsForPod(pod),
                    podIp = pod.status?.podIP,
                    nodeName = pod.spec?.nodeName,
                    createdAtEpochSeconds = pod.metadata?.creationTimestamp?.toEpochSecond(),
                    cpuUsageMilliCores = usage.cpuUsageMilli,
                    memoryUsageBytes = usage.memUsageBytes,
                    cpuRequestMilliCores = totals.cpuRequestMilli,
                    memoryRequestBytes = totals.memRequestBytes,
                    cpuLimitMilliCores = totals.cpuLimitMilli,
                    memoryLimitBytes = totals.memLimitBytes,
                    restartReasons = collectRestartReasonsForPod(pod),
                )
            }
            .sortedBy { it.podName }
    }

    /**
     * Fetch all available namespaces in the cluster
     */
    fun fetchNamespaces(): List<String> {
        return coreApi.listNamespace()
            .execute()
            .items
            .mapNotNull { it.metadata?.name }
            .sorted()
    }

    /**
     * Fetch all available contexts from kubeconfig
     */
    @Suppress("UNCHECKED_CAST")
    fun fetchContexts(): List<String> {
        val kubeConfigPath = System.getenv("KUBECONFIG")
            ?: System.getProperty("user.home") + "/.kube/config"

        return try {
            val yaml = Yaml()
            val config = FileReader(kubeConfigPath).use { reader ->
                yaml.load<Map<String, Any>>(reader)
            }

            val contexts = config["contexts"] as? List<Map<String, Any>> ?: emptyList()
            contexts.mapNotNull { it["name"] as? String }.sorted()
        } catch (e: Exception) {
            emptyList()
        }
    }

    /**
     * Fetch all problematic pods across all services in the namespace.
     * Returns only pods with bad or warning status, sorted by pod name.
     */
    fun fetchProblematicPods(namespace: String): List<PodResourceDetails> {
        // Fetch all pods in the namespace
        val allPods: List<V1Pod> = coreApi.listNamespacedPod(namespace)
            .execute()
            .items

        val podUsageByName: Map<String, UsageTotals> = getCachedPodUsage(namespace)

        // Convert to PodResourceDetails and filter for problematic ones
        return allPods
            .mapNotNull { pod ->
                val podName = pod.metadata?.name ?: return@mapNotNull null
                val usage = podUsageByName[podName] ?: UsageTotals(null, null)
                val totals = sumResourcesFromSinglePodSpec(pod)

                PodResourceDetails(
                    podName = podName,
                    ready = readySummaryForPod(pod),
                    status = if (pod.metadata?.deletionTimestamp != null) "Terminating" else pod.status?.phase,
                    restarts = restartsForPod(pod),
                    podIp = pod.status?.podIP,
                    nodeName = pod.spec?.nodeName,
                    createdAtEpochSeconds = pod.metadata?.creationTimestamp?.toEpochSecond(),
                    cpuUsageMilliCores = usage.cpuUsageMilli,
                    memoryUsageBytes = usage.memUsageBytes,
                    cpuRequestMilliCores = totals.cpuRequestMilli,
                    memoryRequestBytes = totals.memRequestBytes,
                    cpuLimitMilliCores = totals.cpuLimitMilli,
                    memoryLimitBytes = totals.memLimitBytes,
                    restartReasons = collectRestartReasonsForPod(pod),
                )
            }
            .filter { pod -> isPodProblematic(pod) }
            .sortedBy { it.podName }
    }

    /**
     * Determine if a pod is problematic (bad or warning status).
     *
     * BAD: Pod phase is "Failed" OR has OOMKilled/Error in restartReasons OR restarts > 0 and not ready
     * WARNING: Has restarts >= 3 OR has "Completed" in restartReasons (but not bad)
     */
    private fun isPodProblematic(pod: PodResourceDetails): Boolean {
        val phase = pod.status?.lowercase() ?: "unknown"
        val restarts = pod.restarts ?: 0
        val restartReasons = pod.restartReasons ?: emptyMap()
        val restartReasonKeys = restartReasons.keys.map { it.lowercase() }
        val ready = pod.ready ?: "0/0"

        // Parse ready status (e.g., "1/1" -> both are 1, "0/1" -> ready is 0)
        val isReady = ready.split("/").let { parts ->
            if (parts.size == 2) {
                val readyCount = parts[0].toIntOrNull() ?: 0
                val totalCount = parts[1].toIntOrNull() ?: 0
                readyCount == totalCount && totalCount > 0
            } else {
                false
            }
        }

        // BAD conditions
        val isBad = phase == "failed" ||
                    restartReasonKeys.contains("oomkilled") ||
                    restartReasonKeys.contains("error") ||
                    (restarts > 0 && !isReady)

        // WARNING conditions (only if not bad)
        val isWarning = !isBad && (
                restarts >= 3 ||
                restartReasonKeys.contains("completed")
        )

        return isBad || isWarning
    }

    /**
     * Fetch deployment revision history
     */
    fun fetchDeploymentHistory(
        deploymentName: String,
        namespace: String = resolveCurrentNamespace()
    ): io.m10s.kubescout.model.DeploymentHistoryResponse {
        // 1. Get deployment to find current revision
        val deployment = appsApi.readNamespacedDeployment(deploymentName, namespace).execute()
        val currentRevision = deployment.metadata?.annotations?.get("deployment.kubernetes.io/revision")?.toIntOrNull() ?: 0

        // 2. List all ReplicaSets owned by this deployment
        val replicaSets = appsApi.listNamespacedReplicaSet(namespace)
            .execute()
            .items
            .filter { rs ->
                rs.metadata?.ownerReferences?.any {
                    it.kind == "Deployment" && it.name == deploymentName
                } == true
            }

        // 3. Convert to DeploymentRevision list
        val revisions = replicaSets
            .mapNotNull { rs ->
                val rev = rs.metadata?.annotations?.get("deployment.kubernetes.io/revision")?.toIntOrNull() ?: return@mapNotNull null
                val rawImage = rs.spec?.template?.spec?.containers?.firstOrNull()?.image ?: "unknown"
                val createdAt = rs.metadata?.creationTimestamp?.toEpochSecond() ?: 0

                // Try to extract tag from image string
                // If image uses SHA digest (@sha256:...), try to find tag in labels/annotations
                val image = if (rawImage.contains("@sha256:")) {
                    // Try common locations for version tag
                    rs.metadata?.labels?.get("app.kubernetes.io/version")
                        ?: rs.metadata?.labels?.get("version")
                        ?: rs.metadata?.annotations?.get("kubernetes.io/change-cause")?.let { cause ->
                            // Extract tag from change-cause if it contains image reference
                            // Example: "kubectl set image deployment/app app=registry.io/app:v1.2.3"
                            TAG_PATTERN_REGEX.findAll(cause).lastOrNull()?.groupValues?.get(1)
                        }
                        ?: rawImage // Fallback to raw image if no tag found
                } else {
                    rawImage
                }

                io.m10s.kubescout.model.DeploymentRevision(
                    revision = rev,
                    image = image,
                    createdAtEpochSeconds = createdAt,
                    isCurrent = rev == currentRevision
                )
            }
            .sortedByDescending { it.revision }

        return io.m10s.kubescout.model.DeploymentHistoryResponse(
            deploymentName = deploymentName,
            namespace = namespace,
            currentRevision = currentRevision,
            revisions = revisions
        )
    }

    /**
     * Rollback deployment to target revision
     */
    fun rollbackDeployment(
        deploymentName: String,
        namespace: String,
        targetRevision: Int?
    ): io.m10s.kubescout.model.RollbackResponse {
        try {
            // 1. Get deployment history
            val history = fetchDeploymentHistory(deploymentName, namespace)

            // 2. Determine target revision
            val targetRev = targetRevision ?: (history.currentRevision - 1)

            // 3. Validate
            if (targetRev == history.currentRevision) {
                return io.m10s.kubescout.model.RollbackResponse(false, "Cannot rollback to current revision")
            }

            val targetRevisionData = history.revisions.find { it.revision == targetRev }
                ?: return io.m10s.kubescout.model.RollbackResponse(false, "Target revision $targetRev not found in history")

            // 4. Find the ReplicaSet for target revision
            val replicaSets = appsApi.listNamespacedReplicaSet(namespace)
                .execute()
                .items
                .filter { rs ->
                    rs.metadata?.ownerReferences?.any {
                        it.kind == "Deployment" && it.name == deploymentName
                    } == true
                }

            val targetRS = replicaSets.find { rs ->
                rs.metadata?.annotations?.get("deployment.kubernetes.io/revision")?.toIntOrNull() == targetRev
            } ?: return io.m10s.kubescout.model.RollbackResponse(false, "ReplicaSet for revision $targetRev not found")

            // 5. Patch deployment with target ReplicaSet's template
            val deployment = appsApi.readNamespacedDeployment(deploymentName, namespace).execute()
            deployment.spec?.template = targetRS.spec?.template

            appsApi.replaceNamespacedDeployment(deploymentName, namespace, deployment).execute()

            return io.m10s.kubescout.model.RollbackResponse(
                success = true,
                message = "Successfully rolled back to revision $targetRev",
                targetRevision = targetRev
            )
        } catch (e: Exception) {
            return io.m10s.kubescout.model.RollbackResponse(false, "Rollback failed: ${e.message}")
        }
    }

    /**
     * Restart deployment by triggering a rollout restart
     */
    fun restartDeployment(
        serviceName: String,
        namespace: String
    ): io.m10s.kubescout.model.RestartResponse {
        try {
            // The deployment name is typically the same as the service name
            val deploymentName = serviceName

            // Get the deployment
            val deployment = appsApi.readNamespacedDeployment(deploymentName, namespace).execute()

            // Trigger restart by adding/updating a restart annotation
            val now = java.time.Instant.now().toString()
            val annotations = deployment.spec?.template?.metadata?.annotations?.toMutableMap() ?: mutableMapOf()
            annotations["kubectl.kubernetes.io/restartedAt"] = now

            deployment.spec?.template?.metadata?.annotations = annotations

            // Update the deployment
            appsApi.replaceNamespacedDeployment(deploymentName, namespace, deployment).execute()

            return io.m10s.kubescout.model.RestartResponse(
                success = true,
                message = "Successfully restarted deployment",
                deployment = deploymentName,
                namespace = namespace
            )
        } catch (e: Exception) {
            return io.m10s.kubescout.model.RestartResponse(
                success = false,
                message = "Restart failed: ${e.message}"
            )
        }
    }

    // ========================================
    // Feature 5: Service Endpoints View
    // ========================================

    /**
     * Fetch service endpoints including pod IPs, ports, and ingress rules
     */
    fun fetchServiceEndpoints(
        serviceName: String,
        namespace: String = resolveCurrentNamespace()
    ): io.m10s.kubescout.model.ServiceEndpointsResponse {
        // 1. Get service info
        val service = coreApi.readNamespacedService(serviceName, namespace).execute()
        val serviceType = service.spec?.type
        val clusterIP = service.spec?.clusterIP

        // 2. Extract service ports
        val servicePorts = service.spec?.ports?.map { port ->
            io.m10s.kubescout.model.ServicePort(
                name = port.name,
                port = port.port ?: 0,
                targetPort = port.targetPort?.toString(),
                protocol = port.protocol ?: "TCP"
            )
        } ?: emptyList()

        // 3. Get endpoints (pod IPs and ports)
        val endpoints = try {
            val endpointsObj = coreApi.readNamespacedEndpoints(serviceName, namespace).execute()
            val endpointsList = mutableListOf<io.m10s.kubescout.model.ServiceEndpoint>()

            endpointsObj.subsets?.forEach { subset ->
                // Get ports from subset
                val ports = subset.ports?.map { it.port ?: 0 } ?: listOf(0)

                // Add ready endpoints
                subset.addresses?.forEach { addr ->
                    val podName = addr.targetRef?.name
                    ports.forEach { port ->
                        endpointsList.add(
                            io.m10s.kubescout.model.ServiceEndpoint(
                                ip = addr.ip ?: "unknown",
                                port = port,
                                podName = podName,
                                ready = true
                            )
                        )
                    }
                }

                // Add not-ready endpoints
                subset.notReadyAddresses?.forEach { addr ->
                    val podName = addr.targetRef?.name
                    ports.forEach { port ->
                        endpointsList.add(
                            io.m10s.kubescout.model.ServiceEndpoint(
                                ip = addr.ip ?: "unknown",
                                port = port,
                                podName = podName,
                                ready = false
                            )
                        )
                    }
                }
            }
            endpointsList
        } catch (e: Exception) {
            // Endpoints may not exist if service has no pods
            emptyList()
        }

        // 4. Get ingress rules that point to this service
        val networkingApi = io.kubernetes.client.openapi.apis.NetworkingV1Api(client)
        val ingresses = try {
            val ingressList = networkingApi.listNamespacedIngress(namespace).execute()
            val ingressRules = mutableListOf<io.m10s.kubescout.model.IngressRule>()

            ingressList.items.forEach { ingress ->
                // Get load balancer address (IP or hostname)
                val lbIngresses = ingress.status?.loadBalancer?.ingress ?: emptyList()
                val address = lbIngresses.firstOrNull()?.let { lb ->
                    lb.ip?.takeIf { it.isNotBlank() } ?: lb.hostname?.takeIf { it.isNotBlank() }
                }

                ingress.spec?.rules?.forEach { rule ->
                    rule.http?.paths?.forEach { path ->
                        // Check if this path points to our service
                        val backend = path.backend
                        val backendServiceName = backend?.service?.name

                        if (backendServiceName == serviceName) {
                            ingressRules.add(
                                io.m10s.kubescout.model.IngressRule(
                                    host = rule.host,
                                    path = path.path,
                                    backend = backendServiceName,
                                    address = address
                                )
                            )
                        }
                    }
                }
            }
            ingressRules
        } catch (e: Exception) {
            // Ingress API may not be available or RBAC missing
            emptyList()
        }

        return io.m10s.kubescout.model.ServiceEndpointsResponse(
            serviceName = serviceName,
            namespace = namespace,
            serviceType = serviceType,
            clusterIP = clusterIP,
            ports = servicePorts,
            endpoints = endpoints,
            ingresses = ingresses
        )
    }

    // ========================================
    // Feature 1: Pod Events Timeline
    // ========================================

    /**
     * Fetch events for a specific pod, sorted by lastTimestamp descending (most recent first)
     */
    fun fetchPodEvents(
        podName: String,
        namespace: String = resolveCurrentNamespace()
    ): List<io.m10s.kubescout.model.PodEvent> {
        return try {
            // List events with field selector for this specific pod
            val eventList = coreApi.listNamespacedEvent(namespace)
                .fieldSelector("involvedObject.name=$podName")
                .execute()

            // Map K8s events to our PodEvent model
            val events = eventList.items.map { event ->
                io.m10s.kubescout.model.PodEvent(
                    type = event.type,
                    reason = event.reason,
                    message = event.message,
                    count = event.count,
                    firstTimestamp = event.firstTimestamp?.toEpochSecond(),
                    lastTimestamp = event.lastTimestamp?.toEpochSecond()
                        ?: event.eventTime?.toEpochSecond(), // Fallback to eventTime if lastTimestamp is null
                    source = event.source?.component ?: event.reportingComponent
                )
            }

            // Sort by lastTimestamp descending (most recent first) and limit to 50
            events
                .sortedByDescending { it.lastTimestamp ?: 0 }
                .take(50)
        } catch (e: Exception) {
            // Return empty list if events can't be fetched (RBAC or other issues)
            emptyList()
        }
    }

    /**
     * Fetch events for all pods belonging to a service, merged and sorted by lastTimestamp descending.
     * Each event includes a podName field for grouping. Max 100 events total.
     */
    fun fetchServiceEvents(
        serviceName: String,
        namespace: String = resolveCurrentNamespace()
    ): List<io.m10s.kubescout.model.PodEvent> {
        val service: V1Service = coreApi.readNamespacedService(serviceName, namespace).execute()

        val labelSelector = buildLabelSelector(service.spec?.selector ?: emptyMap())
        val pods: List<V1Pod> = fetchPodsForSelector(namespace, labelSelector)

        val allEvents = pods.flatMap { pod ->
            val podName = pod.metadata?.name ?: return@flatMap emptyList<io.m10s.kubescout.model.PodEvent>()
            fetchPodEvents(podName, namespace).map { event ->
                event.copy(podName = podName)
            }
        }

        return allEvents
            .sortedByDescending { it.lastTimestamp ?: 0 }
            .take(100)
    }

    // ========================================
    // Feature 2: Quick Pod Logs View
    // ========================================

    /**
     * Fetch logs for a pod's container
     */
    fun fetchPodLogs(
        podName: String,
        namespace: String = resolveCurrentNamespace(),
        containerName: String? = null,
        tailLines: Int = 500,
        sinceSeconds: Int? = null
    ): io.m10s.kubescout.model.PodLogsResponse {
        try {
            // If no container specified, get the first container from the pod
            val actualContainerName = if (containerName.isNullOrBlank()) {
                val pod = coreApi.readNamespacedPod(podName, namespace).execute()
                pod.spec?.containers?.firstOrNull()?.name
                    ?: throw IllegalArgumentException("Pod has no containers")
            } else {
                containerName
            }

            // Fetch logs
            val logRequest = coreApi.readNamespacedPodLog(podName, namespace)
                .container(actualContainerName)
                .tailLines(tailLines)
            if (sinceSeconds != null) {
                logRequest.sinceSeconds(sinceSeconds)
            }
            val logs = logRequest.execute()

            val lines = logs.split("\n")
            val lineCount = lines.size
            val truncated = lineCount >= tailLines

            return io.m10s.kubescout.model.PodLogsResponse(
                podName = podName,
                containerName = actualContainerName,
                namespace = namespace,
                logs = logs,
                lineCount = lineCount,
                truncated = truncated
            )
        } catch (e: Exception) {
            // Return error message in logs field if fetch fails
            return io.m10s.kubescout.model.PodLogsResponse(
                podName = podName,
                containerName = containerName ?: "unknown",
                namespace = namespace,
                logs = "Failed to fetch logs: ${e.message}",
                lineCount = 0,
                truncated = false
            )
        }
    }

    fun streamPodLogs(
        podName: String,
        namespace: String,
        containerName: String? = null,
        tailLines: Int = 200,
        sinceSeconds: Int? = null,
        context: String? = null,
        onLine: (String) -> Unit
    ) {
        val actualContainerName = if (containerName.isNullOrBlank()) {
            val pod = coreApi.readNamespacedPod(podName, namespace).execute()
            pod.spec?.containers?.firstOrNull()?.name
                ?: throw IllegalArgumentException("Pod has no containers")
        } else {
            containerName
        }

        // kubernetes-client-java v25 fluent API does not expose a streaming execute method.
        // Use kubectl logs --follow via ProcessBuilder — same pattern as execShell.
        val kubeConfigPath = System.getenv("KUBECONFIG")
            ?: (System.getProperty("user.home") + "/.kube/config")
        val args = mutableListOf(
            "kubectl", "--kubeconfig", kubeConfigPath
        )
        if (!context.isNullOrBlank()) args.addAll(listOf("--context", context))
        args.addAll(listOf(
            "logs", "--follow",
            podName,
            "-n", namespace,
            "-c", actualContainerName,
            "--tail", tailLines.toString()
        ))
        if (sinceSeconds != null) args.addAll(listOf("--since", "${sinceSeconds}s"))

        val process = ProcessBuilder(args).redirectErrorStream(true).start()
        try {
            val reader = java.io.BufferedReader(java.io.InputStreamReader(process.inputStream))
            var line: String?
            while (reader.readLine().also { line = it } != null) {
                onLine(line!!)
            }
            val exitCode = process.waitFor()
            logger.debug("LogStream: kubectl exited with code={} for pod={}", exitCode, podName)
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
            process.destroyForcibly()
        } finally {
            process.destroyForcibly()
        }
    }

    fun execShell(podName: String, namespace: String, containerName: String?, context: String = ""): Process {
        // kubernetes-client-java v25.0.0 uses connectPostNamespacedPodExecCall (POST),
        // but some EKS cluster versions only accept GET on the exec endpoint → 404.
        // Use kubectl exec instead, which correctly negotiates the exec protocol.
        //
        // kubectl exec -it requires a real local TTY. Since our subprocess stdin is a pipe,
        // we wrap kubectl in Python's pty.spawn() which creates a pseudo-TTY for kubectl,
        // satisfying the -t requirement while still communicating through our pipes.
        // The container's /bin/sh gets a real TTY → interactive mode (prompt, echo, Ctrl+C).
        val kubeConfigPath = System.getenv("KUBECONFIG")
            ?: (System.getProperty("user.home") + "/.kube/config")
        val kubectlArgs = mutableListOf("kubectl", "--kubeconfig", kubeConfigPath)
        if (context.isNotBlank()) kubectlArgs.addAll(listOf("--context", context))
        kubectlArgs.addAll(listOf("exec", "-it", podName, "-n", namespace))
        if (!containerName.isNullOrBlank()) kubectlArgs.addAll(listOf("-c", containerName))
        // Set TERM and exec into bash (preferred) or sh.
        // Using `command -v bash` + `exec` avoids stderr redirect (bash writes its prompt to stderr,
        // so `bash 2>/dev/null` would suppress the prompt entirely).
        // `exec` replaces sh so the shell inherits the TTY and runs fully interactively.
        kubectlArgs.addAll(listOf("--", "sh", "-c",
            "export TERM=xterm-256color; command -v bash >/dev/null 2>&1 && exec bash || exec sh"))

        // Build Python list literal: ["kubectl", "--kubeconfig", "/root/.kube/config", ...]
        val pyList = kubectlArgs.joinToString(", ") { "\"${it.replace("\\", "\\\\").replace("\"", "\\\"")}\"" }
        val pyScript = "import pty; pty.spawn([$pyList])"
        return ProcessBuilder("python3", "-c", pyScript).redirectErrorStream(false).start()
    }

    fun execShellInCluster(podName: String, namespace: String, containerName: String?): Process {
        // In-cluster: kubectl uses ServiceAccount credentials automatically (no --kubeconfig or --context needed)
        val kubectlArgs = mutableListOf("kubectl", "exec", "-it", podName, "-n", namespace)
        if (!containerName.isNullOrBlank()) kubectlArgs.addAll(listOf("-c", containerName))
        kubectlArgs.addAll(listOf("--", "sh", "-c",
            "export TERM=xterm-256color; command -v bash >/dev/null 2>&1 && exec bash || exec sh"))
        val pyList = kubectlArgs.joinToString(", ") { "\"${it.replace("\\", "\\\\").replace("\"", "\\\"")}\"" }
        val pyScript = "import pty; pty.spawn([$pyList])"
        return ProcessBuilder("python3", "-c", pyScript).redirectErrorStream(false).start()
    }

    fun listContainersForPod(podName: String, namespace: String): List<String> {
        return coreApi.readNamespacedPod(podName, namespace).execute()
            .spec?.containers?.mapNotNull { it.name } ?: emptyList()
    }

    // ========================================
    // Feature 4: ConfigMap/Secret Viewer
    // ========================================

    /**
     * Fetch ConfigMaps and Secrets used by a service's pods
     */
    fun fetchServiceConfigs(
        serviceName: String,
        namespace: String
    ): io.m10s.kubescout.model.ServiceConfigsResponse {
        try {
            // 1. Get service and its pods
            val service = coreApi.readNamespacedService(serviceName, namespace).execute()
            val labelSelector = buildLabelSelector(service.spec?.selector ?: emptyMap())
            val pods = fetchPodsForSelector(namespace, labelSelector)

            // 2. Extract ConfigMap and Secret references from pod specs
            val configMapRefs = mutableMapOf<String, io.m10s.kubescout.model.ConfigReference>()
            val secretRefs = mutableMapOf<String, io.m10s.kubescout.model.ConfigReference>()

            pods.forEach { pod ->
                val volumes = pod.spec?.volumes ?: emptyList()
                val containers = pod.spec?.containers ?: emptyList()

                // Build map of volume name -> mount path
                val volumeMounts = mutableMapOf<String, String>()
                containers.forEach { container ->
                    container.volumeMounts?.forEach { mount ->
                        volumeMounts[mount.name] = mount.mountPath ?: ""
                    }
                }

                volumes.forEach { volume ->
                    val mountPath = volumeMounts[volume.name]

                    // Check for ConfigMap
                    volume.configMap?.let { configMap ->
                        val name = configMap.name ?: return@let
                        val keys = configMap.items?.map { it.key } ?: emptyList()
                        val optional = configMap.optional ?: false

                        configMapRefs[name] = io.m10s.kubescout.model.ConfigReference(
                            name = name,
                            type = "ConfigMap",
                            mountPath = mountPath,
                            keys = keys,
                            optional = optional
                        )
                    }

                    // Check for Secret
                    volume.secret?.let { secret ->
                        val name = secret.secretName ?: return@let
                        val keys = secret.items?.map { it.key } ?: emptyList()
                        val optional = secret.optional ?: false

                        secretRefs[name] = io.m10s.kubescout.model.ConfigReference(
                            name = name,
                            type = "Secret",
                            mountPath = mountPath,
                            keys = keys,
                            optional = optional
                        )
                    }
                }

                // Also check for ConfigMap/Secret references in env vars
                containers.forEach { container ->
                    container.envFrom?.forEach { envFrom ->
                        envFrom.configMapRef?.let { configMapRef ->
                            val name = configMapRef.name ?: return@let
                            if (!configMapRefs.containsKey(name)) {
                                configMapRefs[name] = io.m10s.kubescout.model.ConfigReference(
                                    name = name,
                                    type = "ConfigMap",
                                    mountPath = null, // env vars don't have mount paths
                                    keys = emptyList(), // all keys are used
                                    optional = configMapRef.optional ?: false
                                )
                            }
                        }

                        envFrom.secretRef?.let { secretRef ->
                            val name = secretRef.name ?: return@let
                            if (!secretRefs.containsKey(name)) {
                                secretRefs[name] = io.m10s.kubescout.model.ConfigReference(
                                    name = name,
                                    type = "Secret",
                                    mountPath = null,
                                    keys = emptyList(),
                                    optional = secretRef.optional ?: false
                                )
                            }
                        }
                    }
                }
            }

            val configMapsWithKeys = configMapRefs.values.map { ref ->
                try {
                    val cm = coreApi.readNamespacedConfigMap(ref.name, namespace).execute()
                    val actualKeys = cm.data?.keys?.toList() ?: emptyList()
                    ref.copy(keys = if (ref.keys.isNotEmpty()) ref.keys else actualKeys)
                } catch (e: Exception) {
                    ref
                }
            }

            val secretsWithKeys = secretRefs.values.map { ref ->
                try {
                    val secret = coreApi.readNamespacedSecret(ref.name, namespace).execute()
                    val actualKeys = secret.data?.keys?.toList() ?: emptyList()
                    ref.copy(keys = if (ref.keys.isNotEmpty()) ref.keys else actualKeys)
                } catch (e: Exception) {
                    ref
                }
            }

            return io.m10s.kubescout.model.ServiceConfigsResponse(
                serviceName = serviceName,
                namespace = namespace,
                configMaps = configMapsWithKeys,
                secrets = secretsWithKeys
            )
        } catch (e: Exception) {
            // Return empty lists if fetch fails
            return io.m10s.kubescout.model.ServiceConfigsResponse(
                serviceName = serviceName,
                namespace = namespace,
                configMaps = emptyList(),
                secrets = emptyList()
            )
        }
    }

    /**
     * Fetch full ConfigMap data (all key-value pairs)
     */
    fun fetchConfigMapData(
        name: String,
        namespace: String
    ): io.m10s.kubescout.model.ConfigMapData {
        return try {
            val configMap = coreApi.readNamespacedConfigMap(name, namespace).execute()
            val data = configMap.data ?: emptyMap()

            io.m10s.kubescout.model.ConfigMapData(
                name = name,
                namespace = namespace,
                data = data
            )
        } catch (e: Exception) {
            io.m10s.kubescout.model.ConfigMapData(
                name = name,
                namespace = namespace,
                data = mapOf("error" to "Failed to fetch ConfigMap: ${e.message}")
            )
        }
    }

    /**
     * Fetch Secret keys only (NEVER return secret values for security!)
     */
    fun fetchSecretKeys(
        name: String,
        namespace: String
    ): io.m10s.kubescout.model.SecretData {
        return try {
            val secret = coreApi.readNamespacedSecret(name, namespace).execute()
            // Extract ONLY keys, never values!
            val keys = secret.data?.keys?.toList() ?: emptyList()

            io.m10s.kubescout.model.SecretData(
                name = name,
                namespace = namespace,
                keys = keys
            )
        } catch (e: Exception) {
            io.m10s.kubescout.model.SecretData(
                name = name,
                namespace = namespace,
                keys = listOf("Error: Failed to fetch Secret: ${e.message}")
            )
        }
    }

    fun fetchSecretValue(
        name: String,
        namespace: String,
        key: String
    ): io.m10s.kubescout.model.SecretValueResponse {
        val secret = coreApi.readNamespacedSecret(name, namespace).execute()
        val rawBytes = secret.data?.get(key)
            ?: throw IllegalArgumentException("Key '$key' not found in Secret '$name'")
        // rawBytes is already the decoded byte array from the K8s client;
        // re-encode to base64 so the browser can decode it with atob().
        val encoded = java.util.Base64.getEncoder().encodeToString(rawBytes)
        return io.m10s.kubescout.model.SecretValueResponse(key = key, encodedValue = encoded)
    }

    // ========================================
    // Feature 3: Scale Deployment Controls
    // ========================================

    /**
     * Get current replica count for a deployment
     */
    fun getCurrentReplicas(
        deploymentName: String,
        namespace: String
    ): Int? {
        return try {
            val scale = appsApi.readNamespacedDeploymentScale(deploymentName, namespace).execute()
            scale.spec?.replicas
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Find the HPA (v2) that targets the given deployment name in a namespace.
     * Returns null if no matching HPA is found.
     */
    fun findHpaForDeployment(deploymentName: String, namespace: String): V2HorizontalPodAutoscaler? {
        return try {
            autoscalingV2Api.listNamespacedHorizontalPodAutoscaler(namespace)
                .execute()
                .items
                .firstOrNull { it.spec?.scaleTargetRef?.name == deploymentName }
        } catch (_: Exception) {
            // v2 may not be enabled or RBAC missing — try v1 as fallback
            try {
                val v1Match = autoscalingV1Api.listNamespacedHorizontalPodAutoscaler(namespace)
                    .execute()
                    .items
                    .firstOrNull { it.spec?.scaleTargetRef?.name == deploymentName }
                if (v1Match != null) {
                    // v1 HPA found but patching requires v2 — log and return null
                    logger.info("[K8sServiceReader] findHpaForDeployment: found v1 HPA for $deploymentName but v2 patching is not supported for v1 HPAs")
                }
                null
            } catch (_: Exception) {
                null
            }
        }
    }

    /**
     * Scale an HPA by patching its minReplicas (and optionally maxReplicas).
     */
    fun scaleHpa(
        deploymentName: String,
        namespace: String,
        minReplicas: Int,
        maxReplicas: Int? = null
    ): io.m10s.kubescout.model.ScaleResponse {
        if (minReplicas < 1) {
            return io.m10s.kubescout.model.ScaleResponse(
                success = false,
                message = "HPA minReplicas must be >= 1",
                deploymentName = deploymentName,
                namespace = namespace,
                previousReplicas = null,
                newReplicas = minReplicas,
                scaledVia = "hpa"
            )
        }
        val maxAllowedReplicas = this.maxReplicas
        if (minReplicas > maxAllowedReplicas) {
            return io.m10s.kubescout.model.ScaleResponse(
                success = false,
                message = "minReplicas ($minReplicas) exceeds maximum allowed ($maxAllowedReplicas)",
                deploymentName = deploymentName,
                namespace = namespace,
                previousReplicas = null,
                newReplicas = minReplicas,
                scaledVia = "hpa"
            )
        }
        if (maxReplicas != null && maxReplicas > maxAllowedReplicas) {
            return io.m10s.kubescout.model.ScaleResponse(
                success = false,
                message = "maxReplicas ($maxReplicas) exceeds maximum allowed ($maxAllowedReplicas)",
                deploymentName = deploymentName,
                namespace = namespace,
                previousReplicas = null,
                newReplicas = minReplicas,
                scaledVia = "hpa"
            )
        }

        val hpa = findHpaForDeployment(deploymentName, namespace)
            ?: return io.m10s.kubescout.model.ScaleResponse(
                success = false,
                message = "No HPA found for deployment $deploymentName",
                deploymentName = deploymentName,
                namespace = namespace,
                previousReplicas = null,
                newReplicas = minReplicas,
                scaledVia = "hpa"
            )

        val hpaName = hpa.metadata?.name ?: deploymentName

        if (maxReplicas != null && maxReplicas < minReplicas) {
            return io.m10s.kubescout.model.ScaleResponse(
                success = false,
                message = "maxReplicas ($maxReplicas) must be >= minReplicas ($minReplicas)",
                deploymentName = deploymentName,
                namespace = namespace,
                previousReplicas = null,
                newReplicas = minReplicas,
                scaledVia = "hpa"
            )
        }

        val previousReplicas = hpa.spec?.minReplicas

        return try {
            hpa.spec?.minReplicas = minReplicas
            if (maxReplicas != null && maxReplicas >= minReplicas) {
                hpa.spec?.maxReplicas = maxReplicas
            }

            autoscalingV2Api.replaceNamespacedHorizontalPodAutoscaler(hpaName, namespace, hpa).execute()

            io.m10s.kubescout.model.ScaleResponse(
                success = true,
                message = "Successfully patched HPA $hpaName: minReplicas from ${previousReplicas ?: "unknown"} to $minReplicas",
                deploymentName = deploymentName,
                namespace = namespace,
                previousReplicas = previousReplicas,
                newReplicas = minReplicas,
                scaledVia = "hpa",
                hpaName = hpaName
            )
        } catch (e: Exception) {
            io.m10s.kubescout.model.ScaleResponse(
                success = false,
                message = "Failed to scale HPA: ${e.message}",
                deploymentName = deploymentName,
                namespace = namespace,
                previousReplicas = previousReplicas,
                newReplicas = minReplicas,
                scaledVia = "hpa",
                hpaName = hpaName
            )
        }
    }

    /**
     * Scale a deployment to the specified number of replicas
     */
    fun scaleDeployment(
        deploymentName: String,
        namespace: String,
        replicas: Int
    ): io.m10s.kubescout.model.ScaleResponse {
        // Validate replicas count
        if (replicas < 0) {
            return io.m10s.kubescout.model.ScaleResponse(
                success = false,
                message = "Replica count must be >= 0",
                deploymentName = deploymentName,
                namespace = namespace,
                previousReplicas = null,
                newReplicas = replicas
            )
        }
        val maxAllowedReplicas = maxReplicas
        if (replicas > maxAllowedReplicas) {
            return io.m10s.kubescout.model.ScaleResponse(
                success = false,
                message = "Replica count ($replicas) exceeds maximum allowed ($maxAllowedReplicas)",
                deploymentName = deploymentName,
                namespace = namespace,
                previousReplicas = null,
                newReplicas = replicas
            )
        }

        return try {
            // 1. Get current scale
            val currentScale = appsApi.readNamespacedDeploymentScale(deploymentName, namespace).execute()
            val previousReplicas = currentScale.spec?.replicas

            // 2. Update scale
            currentScale.spec?.replicas = replicas
            appsApi.replaceNamespacedDeploymentScale(deploymentName, namespace, currentScale).execute()

            io.m10s.kubescout.model.ScaleResponse(
                success = true,
                message = "Successfully scaled deployment from ${previousReplicas ?: "unknown"} to $replicas replicas",
                deploymentName = deploymentName,
                namespace = namespace,
                previousReplicas = previousReplicas,
                newReplicas = replicas
            )
        } catch (e: Exception) {
            io.m10s.kubescout.model.ScaleResponse(
                success = false,
                message = "Failed to scale deployment: ${e.message}",
                deploymentName = deploymentName,
                namespace = namespace,
                previousReplicas = null,
                newReplicas = replicas
            )
        }
    }
}
