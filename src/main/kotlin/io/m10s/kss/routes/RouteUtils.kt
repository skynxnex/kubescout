package io.m10s.kss.routes

import io.kubernetes.client.openapi.ApiException
import io.m10s.kss.k8s.K8sServiceReaderFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity

// ==========================================
// Input validation helpers
// ==========================================

internal val SAFE_PARAM_REGEX = Regex("^[a-zA-Z0-9@:._/ -]{1,200}$")

/** Validates Kubernetes resource names (pods, namespaces, etc.). */
internal val K8S_NAME_REGEX = Regex("^[a-z0-9]([a-z0-9._-]{0,251}[a-z0-9])?$")

internal fun validateParam(value: String?): String? {
    if (value.isNullOrBlank()) return null
    return if (SAFE_PARAM_REGEX.matches(value)) value else null
}

// ==========================================
// Shared error helper utilities
// ==========================================

internal fun sanitizeErrorMessage(message: String?): String {
    if (message == null) return "An error occurred"
    return message
        .replace(Regex("https?://[^\\s]+"), "<redacted-url>")
        .replace(Regex("\\b(?:\\d{1,3}\\.){3}\\d{1,3}(?::\\d+)?\\b"), "<redacted-ip>")
        .take(500)
}

internal fun flattenMessages(t: Throwable): String {
    val parts = mutableListOf<String>()
    var cur: Throwable? = t
    var depth = 0
    while (cur != null && depth < 10) {
        cur.message?.let { parts.add(it) }
        cur = cur.cause
        depth++
    }
    return parts.joinToString(" | ")
}

internal fun isAwsSsoAuthError(t: Throwable): Boolean {
    val msg = flattenMessages(t).lowercase()
    return listOf(
        "aws sso",
        "sso session",
        "the sso session",
        "sso token",
        "expiredtoken",
        "unable to load aws credentials",
        "no credential providers",
        "invalid security token",
        "security token included in the request is expired",
        "accessdenied",
    ).any { needle -> msg.contains(needle) }
}

internal fun isKubeUnauthorized(t: Throwable): Boolean {
    val msgs = flattenMessages(t)
    if (msgs.contains("HTTP response code: 401")) return true
    var cur: Throwable? = t
    var depth = 0
    while (cur != null && depth < 10) {
        if (cur is ApiException && cur.code == 401) return true
        cur = cur.cause
        depth++
    }
    return false
}

internal fun localErrorStatus(t: Throwable): HttpStatus =
    if (isAwsSsoAuthError(t) || isKubeUnauthorized(t)) HttpStatus.UNAUTHORIZED
    else HttpStatus.INTERNAL_SERVER_ERROR

internal fun invalidateOnAuthError(error: Throwable, context: String, factory: K8sServiceReaderFactory?) {
    if (factory != null && context.isNotBlank() && (isAwsSsoAuthError(error) || isKubeUnauthorized(error))) {
        factory.invalidate(context)
    }
}

internal fun friendlyServiceListErrorMessage(t: Throwable): String {
    return if (isAwsSsoAuthError(t)) {
        "AWS auth appears to be missing or expired. If using AWS SSO: run 'aws sso login' (possibly with correct --profile) and try again. Original error: ${sanitizeErrorMessage(t.message)}"
    } else {
        "Failed to list services: ${sanitizeErrorMessage(t.message)}"
    }
}

internal fun friendlyLocalServiceListErrorMessage(t: Throwable): String {
    return if (isAwsSsoAuthError(t) || isKubeUnauthorized(t)) {
        "Unauthorized against Kubernetes (401). Are you logged in to AWS? If using AWS SSO: run 'aws sso login' (possibly with correct --profile) and try again. Original error: ${sanitizeErrorMessage(t.message)}"
    } else {
        "Failed to list services: ${sanitizeErrorMessage(t.message)}"
    }
}

// ==========================================
// CSRF header check for POST endpoints
// ==========================================

internal fun checkCsrfHeader(requestedBy: String?): Boolean = requestedBy == "kss"

// ==========================================
// Response helpers
// ==========================================

internal fun errorResponse(message: String, status: HttpStatus): ResponseEntity<Map<String, String>> =
    ResponseEntity.status(status).body(mapOf("message" to message))

internal fun badRequest(message: String): ResponseEntity<Map<String, String>> =
    errorResponse(message, HttpStatus.BAD_REQUEST)

internal fun notFound(message: String): ResponseEntity<Map<String, String>> =
    errorResponse(message, HttpStatus.NOT_FOUND)

internal fun forbidden(message: String): ResponseEntity<Map<String, String>> =
    errorResponse(message, HttpStatus.FORBIDDEN)

internal fun internalError(message: String): ResponseEntity<Map<String, String>> =
    errorResponse(message, HttpStatus.INTERNAL_SERVER_ERROR)
