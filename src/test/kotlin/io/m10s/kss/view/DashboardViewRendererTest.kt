package io.m10s.kss.view

import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.string.shouldContain

class DashboardViewRendererTest : FreeSpec({

    "DashboardViewRenderer" - {

        "should render dashboard with all parameters" {
            val renderer = DashboardViewRenderer()
            val result = renderer.renderDashboard(
                restartRedThreshold = 10,
                humioBaseUrl = "https://humio.example.com",
                humioRepo = "test-repo",
                humioTimeZone = "UTC",
                humioStart = "24h",
                humioNamespace = "test-namespace",
            )

            result shouldContain "KSS"
            result shouldContain "window.RESTART_RED_THRESHOLD = 10"
            result shouldContain "HUMIO_BASE_URL = 'https://humio.example.com'"
            result shouldContain "HUMIO_REPO = 'test-repo'"
            result shouldContain "HUMIO_TZ = 'UTC'"
            result shouldContain "HUMIO_START = '24h'"
            result shouldContain "HUMIO_NAMESPACE = 'test-namespace'"
        }

        "should render dashboard with default parameters" {
            val renderer = DashboardViewRenderer()
            val result = renderer.renderDashboard(restartRedThreshold = 5)

            result shouldContain "KSS"
            result shouldContain "window.RESTART_RED_THRESHOLD = 5"
            result shouldContain "HUMIO_BASE_URL = ''"
            result shouldContain "HUMIO_REPO = ''"
        }

        "should render local dashboard with all parameters" {
            val renderer = DashboardViewRenderer()
            val result = renderer.renderLocalDashboard(
                restartRedThreshold = 15,
                devNamespace = "dev-ns",
                devKubeContext = "dev-context",
                prodNamespace = "prod-ns",
                prodKubeContext = "prod-context",
                humioBaseUrl = "https://humio.example.com",
                humioRepo = "test-repo",
                humioTimeZone = "Europe/Stockholm",
                humioStart = "7d",
                humioNamespace = "test-namespace",
            )

            result shouldContain "KSS"
            result shouldContain "window.RESTART_RED_THRESHOLD = 15"
            result shouldContain "\"dev-ns\""
            result shouldContain "\"dev-context\""
        }

        "should escape special characters in JavaScript strings" {
            val renderer = DashboardViewRenderer()
            val result = renderer.renderDashboard(
                restartRedThreshold = 10,
                humioBaseUrl = "Test\"Quote",
            )

            result shouldContain "HUMIO_BASE_URL = 'Test\\\"Quote'"
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
                humioBaseUrl = "https://humio.example.com",
                humioRepo = "my-repo",
                humioTimeZone = "Europe/Stockholm",
                humioStart = "3d",
                humioNamespace = "prod-namespace",
            )

            result shouldContain "\"dev-ns\""
            result shouldContain "\"dev-ctx\""
            result shouldContain "\"prod-ns\""
            result shouldContain "\"prod-ctx\""
            result shouldContain "HUMIO_BASE_URL = 'https://humio.example.com'"
            result shouldContain "HUMIO_REPO = 'my-repo'"
            result shouldContain "HUMIO_TZ = 'Europe/Stockholm'"
            result shouldContain "HUMIO_START = '3d'"
            result shouldContain "HUMIO_NAMESPACE = 'prod-namespace'"
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
                humioBaseUrl = "path\\to\\file",
            )

            result shouldContain "HUMIO_BASE_URL = 'path\\\\to\\\\file'"
        }

        "jsString escapes newlines in values passed through renderDashboard" {
            val renderer = DashboardViewRenderer()
            val result = renderer.renderDashboard(
                restartRedThreshold = 1,
                humioRepo = "line1\nline2",
            )

            result shouldContain "HUMIO_REPO = 'line1\\nline2'"
        }
    }
})
