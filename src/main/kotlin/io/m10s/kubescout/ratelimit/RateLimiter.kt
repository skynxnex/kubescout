package io.m10s.kubescout.ratelimit

import org.springframework.stereotype.Component
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * Simple in-memory rate limiter that tracks requests per IP address.
 * Uses a sliding window approach with periodic cleanup.
 */
@Component
class RateLimiter(
    private val maxRequestsPerMinute: Int = 100,
) {
    private data class RequestCounter(
        val count: AtomicInteger = AtomicInteger(0),
        var windowStartMs: Long = System.currentTimeMillis(),
    )

    private val requestCounts = ConcurrentHashMap<String, RequestCounter>()
    private val windowSizeMs = 60_000L

    init {
        // Start background cleanup thread
        Thread {
            while (!Thread.currentThread().isInterrupted) {
                try {
                    Thread.sleep(60_000)
                    cleanup()
                } catch (e: InterruptedException) {
                    Thread.currentThread().interrupt()
                    break
                }
            }
        }.apply {
            isDaemon = true
            start()
        }
    }

    fun isAllowed(ipAddress: String): Boolean {
        val now = System.currentTimeMillis()
        val counter = requestCounts.computeIfAbsent(ipAddress) { RequestCounter() }

        synchronized(counter) {
            if (now - counter.windowStartMs >= windowSizeMs) {
                counter.count.set(0)
                counter.windowStartMs = now
            }

            val currentCount = counter.count.incrementAndGet()
            return currentCount <= maxRequestsPerMinute
        }
    }

    fun cleanup() {
        val now = System.currentTimeMillis()
        val staleEntries = requestCounts.filterValues { counter ->
            synchronized(counter) {
                now - counter.windowStartMs >= windowSizeMs * 2
            }
        }
        staleEntries.keys.forEach { requestCounts.remove(it) }
    }
}
