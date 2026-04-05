package io.m10s.kubescout.config

data class AppConfig(
    val localMode: Boolean,
    val localNamespace: String,
    val localContext: String,
    val devNamespace: String,
    val devKubeContext: String,
    val prodNamespace: String,
    val prodKubeContext: String,
    val restartRedThreshold: Int,
    val maxReplicas: Int,
    // Log viewer config (multi-provider: humio, grafana, datadog)
    val logProvider: String,
    val logBaseUrl: String,
    val logRepo: String,
    val logDatasource: String,
    val logTimeZone: String,
    val logStart: String,
    val logNamespace: String,
    val inClusterNamespace: String,
)

object AppConfigLoader {
    fun loadFromEnv(): AppConfig {
        val localMode = System.getenv("LOCAL_MODE")?.equals("true", ignoreCase = true) == true
        val localNamespace = System.getenv("LOCAL_NAMESPACE")?.trim().orEmpty()
        val localContext = System.getenv("LOCAL_KUBE_CONTEXT")?.trim().orEmpty()

        // Optional: expose dev/pro presets to the local dashboard
        val devNamespace = System.getenv("DEV_NAMESPACE")?.trim().orEmpty()
        val devKubeContext = System.getenv("DEV_KUBE_CONTEXT")?.trim().orEmpty()
        val prodNamespace = System.getenv("PROD_NAMESPACE")?.trim().orEmpty()
        val prodKubeContext = System.getenv("PROD_KUBE_CONTEXT")?.trim().orEmpty()

        val restartRedThreshold: Int = System.getenv("DASHBOARD_RESTART_RED_THRESHOLD")
            ?.trim()
            ?.toIntOrNull()
            ?: 3

        val maxReplicas: Int = System.getenv("MAX_REPLICAS")?.toIntOrNull() ?: 50

        val logProvider: String = System.getenv("LOG_PROVIDER")
            ?.trim()
            ?.takeIf { it.isNotBlank() }
            ?: ""

        val logBaseUrl: String = (System.getenv("LOG_BASE_URL") ?: System.getenv("HUMIO_BASE_URL"))
            ?.trim()
            ?.trimEnd('/')
            ?.takeIf { it.isNotBlank() }
            ?: "https://cloud.humio.com"

        val logRepo: String = (System.getenv("LOG_REPO") ?: System.getenv("HUMIO_REPO"))
            ?.trim()
            ?.takeIf { it.isNotBlank() }
            ?: ""

        val logDatasource: String = System.getenv("LOG_DATASOURCE")
            ?.trim()
            ?.takeIf { it.isNotBlank() }
            ?: "Loki"

        val logTimeZone: String = (System.getenv("LOG_TZ") ?: System.getenv("HUMIO_TZ"))
            ?.trim()
            ?.takeIf { it.isNotBlank() }
            ?: "UTC"

        val logStart: String = (System.getenv("LOG_START") ?: System.getenv("HUMIO_START"))
            ?.trim()
            ?.takeIf { it.isNotBlank() }
            ?: "7d"

        val logNamespace: String = (System.getenv("LOG_NAMESPACE") ?: System.getenv("HUMIO_NAMESPACE"))
            ?.trim()
            ?.takeIf { it.isNotBlank() }
            ?: ""

        val inClusterNamespace: String = if (!localMode) {
            try {
                java.io.File("/var/run/secrets/kubernetes.io/serviceaccount/namespace").readText().trim()
            } catch (e: Exception) {
                ""
            }
        } else ""

        return AppConfig(
            localMode = localMode,
            localNamespace = localNamespace,
            localContext = localContext,
            devNamespace = devNamespace,
            devKubeContext = devKubeContext,
            prodNamespace = prodNamespace,
            prodKubeContext = prodKubeContext,
            restartRedThreshold = restartRedThreshold,
            maxReplicas = maxReplicas,
            logProvider = logProvider,
            logBaseUrl = logBaseUrl,
            logRepo = logRepo,
            logDatasource = logDatasource,
            logTimeZone = logTimeZone,
            logStart = logStart,
            logNamespace = logNamespace,
            inClusterNamespace = inClusterNamespace,
        )
    }
}
