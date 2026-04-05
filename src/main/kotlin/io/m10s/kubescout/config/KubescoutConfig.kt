package io.m10s.kubescout.config

import io.m10s.kubescout.k8s.K8sServiceReader
import io.m10s.kubescout.k8s.K8sServiceReaderFactory
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class KubescoutConfig {

    @Bean
    fun appConfig(): AppConfig = AppConfigLoader.loadFromEnv()

    @Bean
    fun serviceReader(appConfig: AppConfig): K8sServiceReader =
        if (appConfig.localMode) {
            K8sServiceReader.fromKubeConfig(appConfig.localContext, appConfig.maxReplicas)
        } else {
            K8sServiceReader.fromCluster(appConfig.maxReplicas)
        }

    @Bean
    fun localServiceReader(appConfig: AppConfig): K8sServiceReader? =
        if (appConfig.localMode) {
            K8sServiceReader.fromKubeConfig(appConfig.localContext, appConfig.maxReplicas)
        } else {
            null
        }

    @Bean
    fun localReaderFactory(appConfig: AppConfig, localServiceReader: K8sServiceReader?): K8sServiceReaderFactory? =
        localServiceReader?.let { K8sServiceReaderFactory(it, appConfig.maxReplicas) }
}
