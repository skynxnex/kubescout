package io.m10s.kubescout.ratelimit

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.stereotype.Component
import org.springframework.web.servlet.HandlerInterceptor

@Component
class RateLimitInterceptor(private val rateLimiter: RateLimiter) : HandlerInterceptor {

    override fun preHandle(request: HttpServletRequest, response: HttpServletResponse, handler: Any): Boolean {
        val ipAddress = getClientIp(request)
        if (!rateLimiter.isAllowed(ipAddress)) {
            response.status = 429
            response.contentType = "application/json"
            response.writer.write("""{"error": "Too many requests. Please try again later."}""")
            return false
        }
        return true
    }

    private fun getClientIp(request: HttpServletRequest): String {
        return request.getHeader("X-Forwarded-For")?.split(",")?.firstOrNull()?.trim()
            ?: request.getHeader("X-Real-IP")
            ?: request.remoteAddr
    }
}
