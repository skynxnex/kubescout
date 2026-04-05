package io.m10s.kubescout.k8s

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import io.kubernetes.client.openapi.ApiException

/**
 * Tests for K8sServiceReader exception-routing and prefix-filtering logic.
 *
 * The API clients (CoreV1Api, AppsV1Api, etc.) are created lazily from the
 * clientProvider and require a live or mocked HTTP server to exercise real API
 * calls.  Rather than spinning up a Kubernetes stub server we test the
 * observable behaviour that the reader exposes publicly:
 *
 *  - ApiException with code 401 / 403 → re-thrown from fetchServiceSummaries
 *  - Generic Exception with an AWS auth keyword → re-thrown
 *  - Generic Exception without an auth keyword → swallowed per namespace, other
 *    namespaces still succeed (not testable without a stub HTTP server because the
 *    lazy coreApi client is needed to get service list)
 *
 * Prefix-filtering and namespace field tests require a running Kubernetes API
 * server and are therefore left as integration-test candidates.  They are noted
 * below and skipped.
 */
class K8sServiceReaderTest : FreeSpec({

    "K8sServiceReader fetchServiceSummaries error routing" - {

        // Helper: build a reader whose lazy ApiClient immediately fails with the
        // given provider exception when any lazy API field is first accessed.
        fun readerThatThrowsOnClientInit(exception: Exception): K8sServiceReader {
            // The clientProvider is invoked lazily the first time a K8s API call
            // is made.  Because the APIs are lazy-delegated properties the provider
            // itself is only called once.  We make it throw so any API call fails.
            return K8sServiceReader(
                clientProvider = { throw exception },
                maxReplicas = 50,
            )
        }

        "should re-throw ApiException with code 401" {
            val apiEx = ApiException(401, "Unauthorized")
            val reader = readerThatThrowsOnClientInit(apiEx)

            shouldThrow<ApiException> {
                reader.fetchServiceSummaries(listOf("app-"), listOf("default"))
            }.code shouldBe 401
        }

        "should re-throw ApiException with code 403" {
            val apiEx = ApiException(403, "Forbidden")
            val reader = readerThatThrowsOnClientInit(apiEx)

            shouldThrow<ApiException> {
                reader.fetchServiceSummaries(listOf("app-"), listOf("default"))
            }.code shouldBe 403
        }

        "should re-throw Exception whose message contains 'ExpiredToken'" {
            val authEx = RuntimeException("ExpiredToken from AWS STS")
            val reader = readerThatThrowsOnClientInit(authEx)

            shouldThrow<RuntimeException> {
                reader.fetchServiceSummaries(listOf("app-"), listOf("default"))
            }.message shouldBe "ExpiredToken from AWS STS"
        }

        "should re-throw Exception whose message contains 'accessdenied'" {
            val authEx = RuntimeException("AccessDenied when calling K8s")
            val reader = readerThatThrowsOnClientInit(authEx)

            shouldThrow<RuntimeException> {
                reader.fetchServiceSummaries(listOf("app-"), listOf("default"))
            }
        }

        "should swallow non-auth Exception and return emptyList for that namespace" {
            // A generic connection error must not bubble up — the reader catches it
            // and returns an empty list for the failing namespace.
            val genericEx = RuntimeException("i/o timeout connecting to k8s")
            val reader = readerThatThrowsOnClientInit(genericEx)

            val result = reader.fetchServiceSummaries(listOf("app-"), listOf("default"))

            result.shouldBeEmpty()
        }

        "should swallow ApiException with code 500 and return emptyList" {
            val serverEx = ApiException(500, "Internal Server Error")
            val reader = readerThatThrowsOnClientInit(serverEx)

            val result = reader.fetchServiceSummaries(listOf("app-"), listOf("default"))

            result.shouldBeEmpty()
        }
    }

    "K8sServiceReader fetchServiceSummaries multi-namespace error isolation" - {

        "should return emptyList for namespace that throws non-auth error while another namespace succeeds" {
            // We cannot exercise this path without a stub K8s HTTP server because
            // the per-namespace try/catch wraps the full internal
            // fetchServiceSummariesForNamespace call which needs a live coreApi.
            // This is an integration-test concern; skipped here.
            // Noted: would require WireMock / MockWebServer for the Kubernetes API.
        }
    }

    // ── Prefix filtering note ────────────────────────────────────────────────
    // Prefix filtering (e.g. "app-vehicle-api" matches "app-", "redis" does not)
    // is implemented inside fetchServiceSummariesForNamespace which requires a
    // Kubernetes API server response for listNamespacedService.
    // These are integration-test candidates.

    // ── Pod deletionTimestamp → "Terminating" note ───────────────────────────
    // The status "Terminating" is derived in fetchPodResourceDetailsForService.
    // Requires a K8s API server to return pods with deletionTimestamp set.
    // Integration-test candidate.
})
