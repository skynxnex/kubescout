package io.m10s.kss.k8s

import com.github.benmanes.caffeine.cache.Caffeine
import mu.KotlinLogging

private val logger = KotlinLogging.logger {}

class K8sServiceReaderFactory(
    private val clusterReader: K8sServiceReader,
    private val maxReplicas: Int,
) {
    private val cache = Caffeine.newBuilder()
        .maximumSize(50)
        .build<String, K8sServiceReader>()

    fun forContext(context: String): K8sServiceReader {
        if (context.isBlank()) return clusterReader
        return cache.get(context) {
            K8sServiceReader.fromKubeConfig(context, maxReplicas)
        }!!
    }

    fun invalidate(context: String) {
        if (context.isBlank()) return
        val existing = cache.getIfPresent(context)
        if (existing != null) {
            cache.invalidate(context)
            logger.info { "Evicting cached reader for context '$context' due to auth error" }
        }
    }
}
