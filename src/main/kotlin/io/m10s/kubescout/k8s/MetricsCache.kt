package io.m10s.kubescout.k8s

import java.util.concurrent.ConcurrentHashMap

/**
 * Simple time-based cache for Kubernetes metrics API results.
 * Reduces load on the metrics-server by caching pod usage data per namespace.
 */
class MetricsCache<K, V>(
    private val ttlMillis: Long = 10_000, // 10 seconds default
) {
    private data class CacheEntry<V>(
        val value: V,
        val timestamp: Long,
    )

    private val cache = ConcurrentHashMap<K, CacheEntry<V>>()
    // Per-key locks prevent a thundering-herd stampede when multiple coroutines
    // concurrently discover an expired entry and would otherwise all call compute().
    private val locks = ConcurrentHashMap<K, Any>()

    /**
     * Gets a value from cache if not expired, otherwise computes and caches it.
     * Only one caller per key will run [compute] at a time; concurrent callers
     * for the same key block until the first computation completes.
     */
    fun getOrCompute(key: K, compute: () -> V): V {
        val now = System.currentTimeMillis()
        val entry = cache[key]

        // Fast path: return cached value if still valid (no lock needed)
        if (entry != null && (now - entry.timestamp) < ttlMillis) {
            return entry.value
        }

        // Slow path: acquire a per-key lock so only one thread recomputes
        val lock = locks.computeIfAbsent(key) { Any() }
        synchronized(lock) {
            // Re-check after acquiring lock — another thread may have already refreshed
            val fresh = cache[key]
            if (fresh != null && (System.currentTimeMillis() - fresh.timestamp) < ttlMillis) {
                return fresh.value
            }
            val newValue = compute()
            cache[key] = CacheEntry(newValue, System.currentTimeMillis())
            return newValue
        }
    }

    /**
     * Clears expired entries from the cache.
     * Should be called periodically to prevent memory leaks.
     */
    fun cleanup() {
        val now = System.currentTimeMillis()
        cache.entries.removeIf { (_, entry) ->
            (now - entry.timestamp) >= ttlMillis * 2
        }
        locks.keys.removeIf { key -> !cache.containsKey(key) }
    }

    /**
     * Clears all entries from the cache.
     */
    fun clear() {
        cache.clear()
    }
}
