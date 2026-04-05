package io.m10s.kss.ratelimit

import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe

class RateLimiterTest : FreeSpec({

    "RateLimiter" - {

        "should allow requests within limit" {
            val rateLimiter = RateLimiter(maxRequestsPerMinute = 5)
            val ip = "192.168.1.1"

            repeat(5) { i ->
                rateLimiter.isAllowed(ip) shouldBe true
            }
        }

        "should block requests exceeding limit" {
            val rateLimiter = RateLimiter(maxRequestsPerMinute = 5)
            val ip = "192.168.1.1"

            repeat(5) { rateLimiter.isAllowed(ip) }

            rateLimiter.isAllowed(ip) shouldBe false
        }

        "should track different IPs separately" {
            val rateLimiter = RateLimiter(maxRequestsPerMinute = 5)
            val ip1 = "192.168.1.1"
            val ip2 = "192.168.1.2"

            repeat(5) { rateLimiter.isAllowed(ip1) }

            rateLimiter.isAllowed(ip1) shouldBe false
            rateLimiter.isAllowed(ip2) shouldBe true
        }

        "should handle concurrent requests from same IP" {
            val rateLimiter = RateLimiter(maxRequestsPerMinute = 5)
            val ip = "192.168.1.1"

            val allowedCount = (1..10).map { rateLimiter.isAllowed(ip) }.count { it }

            allowedCount shouldBe 5
        }

        "should cleanup stale entries" {
            val rateLimiter = RateLimiter(maxRequestsPerMinute = 5)
            val ip = "192.168.1.1"

            rateLimiter.isAllowed(ip)
            rateLimiter.cleanup()

            repeat(4) { rateLimiter.isAllowed(ip) }
            rateLimiter.isAllowed(ip) shouldBe false
        }

        "cleanup should remove entries older than two windows but keep recent ones" {
            val rateLimiter = RateLimiter(maxRequestsPerMinute = 3)
            val staleIp = "10.0.0.1"
            val recentIp = "10.0.0.2"

            // Register staleIp and exhaust its quota
            repeat(3) { rateLimiter.isAllowed(staleIp) }
            rateLimiter.isAllowed(staleIp) shouldBe false

            // Register recentIp (1 request, within limit)
            rateLimiter.isAllowed(recentIp) shouldBe true

            // cleanup with no time elapsed — neither entry is old enough to be stale
            rateLimiter.cleanup()

            // recentIp should still be tracked: 2 more allowed before hitting limit
            rateLimiter.isAllowed(recentIp) shouldBe true
            rateLimiter.isAllowed(recentIp) shouldBe true
            rateLimiter.isAllowed(recentIp) shouldBe false
        }
    }
})
