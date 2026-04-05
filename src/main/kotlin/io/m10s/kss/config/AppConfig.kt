package io.m10s.kss.config

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
    // Humio linking (optional)
    val humioBaseUrl: String,
    val humioRepo: String,
    val humioTimeZone: String,
    val humioStart: String,
    val humioNamespace: String,
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

        val humioBaseUrl: String = System.getenv("HUMIO_BASE_URL")
            ?.trim()
            ?.trimEnd('/')
            ?.takeIf { it.isNotBlank() }
            ?: "https://cloud.humio.com"

        val humioRepo: String = System.getenv("HUMIO_REPO")
            ?.trim()
            ?.takeIf { it.isNotBlank() }
            ?: ""

        val humioTimeZone: String = System.getenv("HUMIO_TZ")
            ?.trim()
            ?.takeIf { it.isNotBlank() }
            ?: "UTC"

        val humioStart: String = System.getenv("HUMIO_START")
            ?.trim()
            ?.takeIf { it.isNotBlank() }
            ?: "7d"

        val humioNamespace: String = System.getenv("HUMIO_NAMESPACE")
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
            humioBaseUrl = humioBaseUrl,
            humioRepo = humioRepo,
            humioTimeZone = humioTimeZone,
            humioStart = humioStart,
            humioNamespace = humioNamespace,
            inClusterNamespace = inClusterNamespace,
        )
    }
}
