package io.m10s.kubescout.k8s

import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe

class MetricsCacheTest : FreeSpec({

    "MetricsCache" - {

        "should cache computed value" {
            val cache = MetricsCache<String, String>(ttlMillis = 1000)
            var computeCount = 0

            val compute = {
                computeCount++
                "value-$computeCount"
            }

            val result1 = cache.getOrCompute("key1", compute)
            result1 shouldBe "value-1"
            computeCount shouldBe 1

            val result2 = cache.getOrCompute("key1", compute)
            result2 shouldBe "value-1"
            computeCount shouldBe 1
        }

        "should recompute after TTL expires" {
            val cache = MetricsCache<String, String>(ttlMillis = 100)
            var computeCount = 0

            val compute = {
                computeCount++
                "value-$computeCount"
            }

            val result1 = cache.getOrCompute("key1", compute)
            result1 shouldBe "value-1"

            Thread.sleep(150)

            val result2 = cache.getOrCompute("key1", compute)
            result2 shouldBe "value-2"
            computeCount shouldBe 2
        }

        "should cache different keys separately" {
            val cache = MetricsCache<String, String>(ttlMillis = 1000)
            var computeCount = 0

            val compute = { key: String ->
                {
                    computeCount++
                    "value-$key-$computeCount"
                }
            }

            val result1 = cache.getOrCompute("key1", compute("key1"))
            val result2 = cache.getOrCompute("key2", compute("key2"))

            result1 shouldBe "value-key1-1"
            result2 shouldBe "value-key2-2"
            computeCount shouldBe 2
        }

        "should clear all cached entries" {
            val cache = MetricsCache<String, String>(ttlMillis = 1000)
            var computeCount = 0

            val compute = {
                computeCount++
                "value-$computeCount"
            }

            cache.getOrCompute("key1", compute)
            computeCount shouldBe 1

            cache.clear()

            cache.getOrCompute("key1", compute)
            computeCount shouldBe 2
        }

        "should cleanup expired entries" {
            val cache = MetricsCache<String, String>(ttlMillis = 50)

            cache.getOrCompute("key1") { "value1" }
            cache.getOrCompute("key2") { "value2" }

            Thread.sleep(120)

            cache.cleanup()

            var recomputed = false
            cache.getOrCompute("key1") {
                recomputed = true
                "new-value1"
            }

            recomputed shouldBe true
        }

        "getOrCompute should propagate exception from compute and not cache anything" {
            val cache = MetricsCache<String, String>(ttlMillis = 1000)
            var computeCount = 0

            val badCompute = {
                computeCount++
                throw RuntimeException("compute failed")
                @Suppress("UNREACHABLE_CODE")
                "never"
            }

            try { cache.getOrCompute("key1", badCompute) } catch (_: RuntimeException) {}
            computeCount shouldBe 1

            // A second call must invoke compute again — nothing was cached
            try { cache.getOrCompute("key1", badCompute) } catch (_: RuntimeException) {}
            computeCount shouldBe 2
        }

        "cleanup should remove orphaned locks for keys no longer in cache" {
            val cache = MetricsCache<String, String>(ttlMillis = 50)

            cache.getOrCompute("key1") { "value1" }

            // Wait for TTL * 2 so cleanup considers the entry stale
            Thread.sleep(120)
            cache.cleanup()

            // After cleanup the entry and its lock should be gone;
            // a fresh compute must run on the next call
            var recomputed = false
            cache.getOrCompute("key1") {
                recomputed = true
                "refreshed"
            }
            recomputed shouldBe true
        }
    }
})
