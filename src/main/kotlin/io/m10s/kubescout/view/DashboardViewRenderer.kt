package io.m10s.kubescout.view

import org.springframework.stereotype.Component
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

@Component
class DashboardViewRenderer(
    private val classLoader: ClassLoader = Thread.currentThread().contextClassLoader,
) {
    // Cache for resource hashes (computed once at startup, thread-safe)
    private val resourceHashCache = ConcurrentHashMap<String, String>()

    private fun loadResourceText(path: String): String {
        return classLoader.getResourceAsStream(path)?.use { input ->
            input.readBytes().toString(Charsets.UTF_8)
        } ?: throw IllegalStateException("Missing resource on classpath: $path")
    }

    private fun jsString(value: String): String {
        return value
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "")
    }

    /**
     * Compute MD5 hash of a resource file for cache busting
     * Results are cached to avoid recomputing on every request
     */
    private fun getResourceHash(path: String): String {
        return resourceHashCache.getOrPut(path) {
            try {
                classLoader.getResourceAsStream(path)?.use { input ->
                    val bytes = input.readBytes()
                    val md5 = MessageDigest.getInstance("MD5")
                    val digest = md5.digest(bytes)
                    digest.joinToString("") { "%02x".format(it) }.take(8) // First 8 chars of MD5
                } ?: "dev" // Fallback if resource not found
            } catch (e: Exception) {
                "dev" // Fallback on error
            }
        }
    }

    /**
     * Get cache-busting version string for a resource
     */
    private fun getCacheBuster(path: String): String {
        return "v=${getResourceHash(path)}"
    }

    fun renderDashboard(
        restartRedThreshold: Int,
        logProvider: String = "",
        logBaseUrl: String = "",
        logRepo: String = "",
        logDatasource: String = "",
        logTimeZone: String = "",
        logStart: String = "",
        logNamespace: String = "",
        inClusterNamespace: String = "",
    ): String {
        // Use same dashboard as local mode (unified dashboard)
        return renderLocalDashboard(
            restartRedThreshold = restartRedThreshold,
            isLocalMode = false,
            inClusterNamespace = inClusterNamespace,
            devNamespace = "",
            devKubeContext = "",
            prodNamespace = "",
            prodKubeContext = "",
            logProvider = logProvider,
            logBaseUrl = logBaseUrl,
            logRepo = logRepo,
            logDatasource = logDatasource,
            logTimeZone = logTimeZone,
            logStart = logStart,
            logNamespace = logNamespace,
        )
    }

    fun renderLocalDashboard(
        restartRedThreshold: Int,
        isLocalMode: Boolean = true,
        inClusterNamespace: String = "",
        devNamespace: String,
        devKubeContext: String,
        prodNamespace: String,
        prodKubeContext: String,
        logProvider: String = "",
        logBaseUrl: String = "",
        logRepo: String = "",
        logDatasource: String = "",
        logTimeZone: String = "",
        logStart: String = "",
        logNamespace: String = "",
    ): String {
        // Combine hashes from both base and theme CSS files
        val baseHash = getResourceHash("dashboard/css/shared/base.css")
        val themeHash = getResourceHash("dashboard/css/themes/cyberpunk.css")
        val cssHash = "v=${baseHash}_${themeHash}"
        val jsHash = getCacheBuster("dashboard/js/main.js")

        return loadResourceText("dashboard/index.html")
            .replace("{{restartRedThreshold}}", restartRedThreshold.toString())
            .replace("{{IS_LOCAL_MODE}}", if (isLocalMode) "true" else "false")
            .replace("{{IN_CLUSTER_NAMESPACE}}", jsString(inClusterNamespace))
            .replace("{{DEV_NAMESPACE}}", jsString(devNamespace))
            .replace("{{DEV_KUBE_CONTEXT}}", jsString(devKubeContext))
            .replace("{{PROD_NAMESPACE}}", jsString(prodNamespace))
            .replace("{{PROD_KUBE_CONTEXT}}", jsString(prodKubeContext))
            .replace("{{LOG_PROVIDER}}", jsString(logProvider))
            .replace("{{LOG_BASE_URL}}", jsString(logBaseUrl))
            .replace("{{LOG_REPO}}", jsString(logRepo))
            .replace("{{LOG_DATASOURCE}}", jsString(logDatasource))
            .replace("{{LOG_TZ}}", jsString(logTimeZone))
            .replace("{{LOG_START}}", jsString(logStart))
            .replace("{{LOG_NAMESPACE}}", jsString(logNamespace))
            .replace("{{CSS_HASH}}", cssHash)
            .replace("{{JS_HASH}}", jsHash)
    }

    fun renderProblematicPodsPage(
        devNamespace: String,
        devKubeContext: String,
        prodNamespace: String,
        prodKubeContext: String,
        logProvider: String = "",
        logBaseUrl: String = "",
        logRepo: String = "",
        logDatasource: String = "",
        logTimeZone: String = "",
        logStart: String = "",
        logNamespace: String = "",
    ): String {
        // Combine hashes from both base and theme CSS files
        val baseHash = getResourceHash("dashboard/css/shared/base.css")
        val themeHash = getResourceHash("dashboard/css/themes/cyberpunk.css")
        val podDetailsHash = getResourceHash("dashboard/css/pod-details.css")
        val cssHash = "v=${baseHash}_${themeHash}_${podDetailsHash}"
        val jsHash = getCacheBuster("dashboard/js/problematic-pods.js")

        return loadResourceText("dashboard/problematic-pods.html")
            .replace("{{DEV_NAMESPACE}}", jsString(devNamespace))
            .replace("{{DEV_KUBE_CONTEXT}}", jsString(devKubeContext))
            .replace("{{PROD_NAMESPACE}}", jsString(prodNamespace))
            .replace("{{PROD_KUBE_CONTEXT}}", jsString(prodKubeContext))
            .replace("{{LOG_PROVIDER}}", jsString(logProvider))
            .replace("{{LOG_BASE_URL}}", jsString(logBaseUrl))
            .replace("{{LOG_REPO}}", jsString(logRepo))
            .replace("{{LOG_DATASOURCE}}", jsString(logDatasource))
            .replace("{{LOG_TZ}}", jsString(logTimeZone))
            .replace("{{LOG_START}}", jsString(logStart))
            .replace("{{LOG_NAMESPACE}}", jsString(logNamespace))
            .replace("{{CSS_HASH}}", cssHash)
            .replace("{{JS_HASH}}", jsHash)
    }
}
