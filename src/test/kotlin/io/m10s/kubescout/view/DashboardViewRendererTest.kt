package io.m10s.kubescout.view

import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.string.shouldContain

class DashboardViewRendererTest : FreeSpec({

    "DashboardViewRenderer" - {

        "should render dashboard with all parameters" {
            val renderer = DashboardViewRenderer()
            val result = renderer.renderDashboard(
                restartRedThreshold = 10,
                logProvider = "humio",
                logBaseUrl = "https://humio.example.com",
                logRepo = "test-repo",
                logDatasource = "Loki",
                logTimeZone = "UTC",
                logStart = "24h",
                logNamespace = "test-namespace",
            )

            result shouldContain "Kubescout"
            result shouldContain "window.RESTART_RED_THRESHOLD = 10"
            result shouldContain "LOG_PROVIDER = 'humio'"
            result shouldContain "LOG_BASE_URL = 'https://humio.example.com'"
            result shouldContain "LOG_REPO = 'test-repo'"
            result shouldContain "LOG_DATASOURCE = 'Loki'"
            result shouldContain "LOG_TZ = 'UTC'"
            result shouldContain "LOG_START = '24h'"
            result shouldContain "LOG_NAMESPACE = 'test-namespace'"
        }

        "should render dashboard with default parameters" {
            val renderer = DashboardViewRenderer()
            val result = renderer.renderDashboard(restartRedThreshold = 5)

            result shouldContain "Kubescout"
            result shouldContain "window.RESTART_RED_THRESHOLD = 5"
            result shouldContain "LOG_BASE_URL = ''"
            result shouldContain "LOG_REPO = ''"
        }

        "should render local dashboard with all parameters" {
            val renderer = DashboardViewRenderer()
            val result = renderer.renderLocalDashboard(
                restartRedThreshold = 15,
                devNamespace = "dev-ns",
                devKubeContext = "dev-context",
                prodNamespace = "prod-ns",
                prodKubeContext = "prod-context",
                logProvider = "grafana",
                logBaseUrl = "https://grafana.example.com",
                logRepo = "test-repo",
                logDatasource = "Loki",
                logTimeZone = "Europe/Stockholm",
                logStart = "7d",
                logNamespace = "test-namespace",
            )

            result shouldContain "Kubescout"
            result shouldContain "window.RESTART_RED_THRESHOLD = 15"
            result shouldContain "\"dev-ns\""
            result shouldContain "\"dev-context\""
        }

        "should escape special characters in JavaScript strings" {
            val renderer = DashboardViewRenderer()
            val result = renderer.renderDashboard(
                restartRedThreshold = 10,
                logBaseUrl = "Test\"Quote",
            )

            result shouldContain "LOG_BASE_URL = 'Test\\\"Quote'"
        }

        "should contain CSS links" {
            val renderer = DashboardViewRenderer()
            val result = renderer.renderDashboard(restartRedThreshold = 10)

            result shouldContain "/dashboard/css/"
        }

        "renderProblematicPodsPage should contain all injected values" {
            val renderer = DashboardViewRenderer()
            val result = renderer.renderProblematicPodsPage(
                devNamespace = "dev-ns",
                devKubeContext = "dev-ctx",
                prodNamespace = "prod-ns",
                prodKubeContext = "prod-ctx",
                logProvider = "humio",
                logBaseUrl = "https://humio.example.com",
                logRepo = "my-repo",
                logDatasource = "Loki",
                logTimeZone = "Europe/Stockholm",
                logStart = "3d",
                logNamespace = "prod-namespace",
            )

            result shouldContain "\"dev-ns\""
            result shouldContain "\"dev-ctx\""
            result shouldContain "\"prod-ns\""
            result shouldContain "\"prod-ctx\""
            result shouldContain "LOG_PROVIDER = 'humio'"
            result shouldContain "LOG_BASE_URL = 'https://humio.example.com'"
            result shouldContain "LOG_REPO = 'my-repo'"
            result shouldContain "LOG_TZ = 'Europe/Stockholm'"
            result shouldContain "LOG_START = '3d'"
            result shouldContain "LOG_NAMESPACE = 'prod-namespace'"
        }

        "renderLocalDashboard should replace IS_LOCAL_MODE with true" {
            val renderer = DashboardViewRenderer()
            val result = renderer.renderLocalDashboard(
                restartRedThreshold = 5,
                isLocalMode = true,
                devNamespace = "dev-ns",
                devKubeContext = "dev-ctx",
                prodNamespace = "prod-ns",
                prodKubeContext = "prod-ctx",
            )

            result shouldContain "IS_LOCAL_MODE = true"
        }

        "renderLocalDashboard should replace IN_CLUSTER_NAMESPACE with provided value" {
            val renderer = DashboardViewRenderer()
            val result = renderer.renderLocalDashboard(
                restartRedThreshold = 5,
                isLocalMode = false,
                inClusterNamespace = "my-cluster-ns",
                devNamespace = "",
                devKubeContext = "",
                prodNamespace = "",
                prodKubeContext = "",
            )

            result shouldContain "\"my-cluster-ns\""
        }

        "jsString escapes backslashes in values passed through renderDashboard" {
            val renderer = DashboardViewRenderer()
            val result = renderer.renderDashboard(
                restartRedThreshold = 1,
                logBaseUrl = "path\\to\\file",
            )

            result shouldContain "LOG_BASE_URL = 'path\\\\to\\\\file'"
        }

        "jsString escapes newlines in values passed through renderDashboard" {
            val renderer = DashboardViewRenderer()
            val result = renderer.renderDashboard(
                restartRedThreshold = 1,
                logRepo = "line1\nline2",
            )

            result shouldContain "LOG_REPO = 'line1\\nline2'"
        }
    }
})
