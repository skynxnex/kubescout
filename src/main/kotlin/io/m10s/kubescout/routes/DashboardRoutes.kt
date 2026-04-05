package io.m10s.kubescout.routes

import io.m10s.kubescout.config.AppConfig
import io.m10s.kubescout.view.DashboardViewRenderer
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

@RestController
class DashboardController(
    private val appConfig: AppConfig,
    private val dashboardViewRenderer: DashboardViewRenderer,
) {

    @GetMapping("/health")
    fun health(): String = "OK"

    @GetMapping("/", produces = [MediaType.TEXT_HTML_VALUE])
    fun dashboard(): ResponseEntity<String> {
        val html = dashboardViewRenderer.renderDashboard(
            restartRedThreshold = appConfig.restartRedThreshold,
            humioBaseUrl = appConfig.humioBaseUrl,
            humioRepo = appConfig.humioRepo,
            humioTimeZone = appConfig.humioTimeZone,
            humioStart = appConfig.humioStart,
            humioNamespace = appConfig.humioNamespace,
            inClusterNamespace = appConfig.inClusterNamespace,
        )
        return ResponseEntity.ok()
            .contentType(MediaType.TEXT_HTML)
            .body(html)
    }

    @GetMapping("/dashboard-local", produces = [MediaType.TEXT_HTML_VALUE])
    fun dashboardLocal(): ResponseEntity<String> {
        val html = dashboardViewRenderer.renderLocalDashboard(
            restartRedThreshold = appConfig.restartRedThreshold,
            isLocalMode = true,
            inClusterNamespace = "",
            devNamespace = appConfig.devNamespace,
            devKubeContext = appConfig.devKubeContext,
            prodNamespace = appConfig.prodNamespace,
            prodKubeContext = appConfig.prodKubeContext,
            humioBaseUrl = appConfig.humioBaseUrl,
            humioRepo = appConfig.humioRepo,
            humioTimeZone = appConfig.humioTimeZone,
            humioStart = appConfig.humioStart,
            humioNamespace = appConfig.humioNamespace,
        )
        return ResponseEntity.ok()
            .contentType(MediaType.TEXT_HTML)
            .body(html)
    }

    @GetMapping("/problematic-pods", produces = [MediaType.TEXT_HTML_VALUE])
    fun problematicPods(): ResponseEntity<String> {
        val html = dashboardViewRenderer.renderProblematicPodsPage(
            devNamespace = appConfig.devNamespace,
            devKubeContext = appConfig.devKubeContext,
            prodNamespace = appConfig.prodNamespace,
            prodKubeContext = appConfig.prodKubeContext,
            humioBaseUrl = appConfig.humioBaseUrl,
            humioRepo = appConfig.humioRepo,
            humioTimeZone = appConfig.humioTimeZone,
            humioStart = appConfig.humioStart,
            humioNamespace = appConfig.humioNamespace,
        )
        return ResponseEntity.ok()
            .contentType(MediaType.TEXT_HTML)
            .body(html)
    }
}
