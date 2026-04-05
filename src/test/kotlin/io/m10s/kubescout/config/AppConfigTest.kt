package io.m10s.kubescout.config

import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe

class AppConfigTest : FreeSpec({

    "AppConfig data class" - {

        "localMode is true when constructed with localMode = true" {
            val config = AppConfig(
                localMode = true,
                localNamespace = "my-ns",
                localContext = "my-ctx",
                devNamespace = "",
                devKubeContext = "",
                prodNamespace = "",
                prodKubeContext = "",
                restartRedThreshold = 3,
                maxReplicas = 50,
                humioBaseUrl = "",
                humioRepo = "",
                humioTimeZone = "UTC",
                humioStart = "7d",
                humioNamespace = "",
                inClusterNamespace = "",
            )

            config.localMode shouldBe true
        }

        "localMode is false when constructed with localMode = false" {
            val config = AppConfig(
                localMode = false,
                localNamespace = "",
                localContext = "",
                devNamespace = "",
                devKubeContext = "",
                prodNamespace = "",
                prodKubeContext = "",
                restartRedThreshold = 3,
                maxReplicas = 50,
                humioBaseUrl = "",
                humioRepo = "",
                humioTimeZone = "UTC",
                humioStart = "7d",
                humioNamespace = "",
                inClusterNamespace = "",
            )

            config.localMode shouldBe false
        }

        "localNamespace returns the namespace field value" {
            val config = AppConfig(
                localMode = true,
                localNamespace = "test-ns",
                localContext = "",
                devNamespace = "",
                devKubeContext = "",
                prodNamespace = "",
                prodKubeContext = "",
                restartRedThreshold = 3,
                maxReplicas = 50,
                humioBaseUrl = "",
                humioRepo = "",
                humioTimeZone = "UTC",
                humioStart = "7d",
                humioNamespace = "",
                inClusterNamespace = "",
            )

            config.localNamespace shouldBe "test-ns"
        }

        "localContext returns the context field value" {
            val config = AppConfig(
                localMode = true,
                localNamespace = "",
                localContext = "arn:aws:eks:eu-west-1:123456789:cluster/dev",
                devNamespace = "",
                devKubeContext = "",
                prodNamespace = "",
                prodKubeContext = "",
                restartRedThreshold = 3,
                maxReplicas = 50,
                humioBaseUrl = "",
                humioRepo = "",
                humioTimeZone = "UTC",
                humioStart = "7d",
                humioNamespace = "",
                inClusterNamespace = "",
            )

            config.localContext shouldBe "arn:aws:eks:eu-west-1:123456789:cluster/dev"
        }

        "restartRedThreshold defaults to 3 in loadFromEnv when env var is absent" {
            // AppConfigLoader.loadFromEnv reads System.getenv() directly.
            // We can only assert the parsed default when the env var is not set.
            // This test is only meaningful when DASHBOARD_RESTART_RED_THRESHOLD is unset.
            if (System.getenv("DASHBOARD_RESTART_RED_THRESHOLD") == null) {
                val config = AppConfigLoader.loadFromEnv()
                config.restartRedThreshold shouldBe 3
            }
        }

        "maxReplicas defaults to 50 in loadFromEnv when env var is absent" {
            if (System.getenv("MAX_REPLICAS") == null) {
                val config = AppConfigLoader.loadFromEnv()
                config.maxReplicas shouldBe 50
            }
        }

        "humioStart defaults to '7d' in loadFromEnv when env var is absent" {
            if (System.getenv("HUMIO_START") == null) {
                val config = AppConfigLoader.loadFromEnv()
                config.humioStart shouldBe "7d"
            }
        }

        "humioBaseUrl defaults to 'https://cloud.humio.com' in loadFromEnv when env var is absent" {
            if (System.getenv("HUMIO_BASE_URL") == null) {
                val config = AppConfigLoader.loadFromEnv()
                config.humioBaseUrl shouldBe "https://cloud.humio.com"
            }
        }
    }
})
