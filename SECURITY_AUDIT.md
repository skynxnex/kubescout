# Security Audit Report - Kubernetes Dashboard (5 New Features)

**Audit Date:** 2026-03-10
**Audited Features:**
1. Pod Events Timeline (`/pod-events`, `/pod-events-local`)
2. Quick Pod Logs View (`/pod-logs`, `/pod-logs-local`)
3. Scale Deployment Controls (`/scale-deployment-local`)
4. ConfigMap/Secret Viewer (`/service-configs-local`, `/configmap-data-local`, `/secret-keys-local`)
5. Service Endpoints View (`/service-endpoints`, `/service-endpoints-local`)

---

## Executive Summary

**Overall Risk Level:** MEDIUM

The new features introduce 5 new endpoints with varying security implications. Critical findings include missing audit logging for write operations, potential DoS vulnerabilities in log fetching, and incomplete input validation. However, XSS protection is properly implemented, and secrets are correctly handled (keys only, no values exposed).

**Issues Found:**
- 1 High Priority
- 4 Medium Priority
- 2 Low Priority

---

## Critical Issues (Fix Immediately)

None identified.

---

## High Priority Issues (Fix within 1 week)

### 1. [HIGH] Missing Audit Logging for Scale Deployment Operations

**Location:** `/src/main/kotlin/org/example/routes/Routes.kt:820-854`

**Issue:** The `POST /scale-deployment-local` endpoint performs write operations (scaling deployments) but does NOT log successful scale operations for audit trails. Only failures are logged.

**Evidence:**
```kotlin
// Routes.kt:820-854
post("/scale-deployment-local") {
    runCatching {
        val request = call.receive<org.example.model.ScaleRequest>()
        // ... performs scaling ...
        reader.scaleDeployment(request.deploymentName, request.namespace, request.replicas)
    }.onSuccess { response ->
        // ❌ NO LOGGING HERE - successful scale operations are invisible
        val payload = json.encodeToString(response)
        call.respondText(payload, contentType = ContentType.Application.Json)
    }.onFailure { error ->
        // ✅ Only errors are logged
        call.application.log.error("Scale deployment failed", error)
    }
}
```

**Risk:**
- No audit trail for who scaled what deployment and when
- Compliance violation (GDPR/SOC2 require audit logs for infrastructure changes)
- Difficult to investigate incidents or unauthorized changes
- No way to track deployment scaling history

**Fix:**
Add structured audit logging for successful scale operations:

```kotlin
.onSuccess { response ->
    // Add audit logging
    call.application.log.info(
        "Deployment scaled successfully: " +
        "deployment=${request.deploymentName}, " +
        "namespace=${request.namespace}, " +
        "previousReplicas=${response.previousReplicas}, " +
        "newReplicas=${request.replicas}, " +
        "user=${call.request.headers["X-Forwarded-User"] ?: "unknown"}, " +
        "source=${call.request.origin.remoteHost}"
    )
    val payload = json.encodeToString(response)
    call.respondText(payload, contentType = ContentType.Application.Json)
}
```

**Recommended fields to log:**
- Timestamp (automatic)
- Deployment name
- Namespace
- Previous replica count
- New replica count
- User identity (if available via header/auth)
- Source IP
- Success/failure status

---

## Medium Priority Issues (Fix within 1 month)

### 1. [MEDIUM] Denial of Service via Unbounded tailLines Parameter

**Location:** `/src/main/kotlin/org/example/routes/Routes.kt:657,687`

**Issue:** The `tailLines` parameter in pod logs endpoints has no upper bound validation. An attacker can request unlimited log lines, causing memory exhaustion.

**Evidence:**
```kotlin
// Routes.kt:657
val tailLines = call.request.queryParameters["tailLines"]?.toIntOrNull() ?: 100

// K8sServiceReader.kt:1053
val logs = coreApi.readNamespacedPodLog(podName, namespace)
    .container(actualContainerName)
    .tailLines(tailLines)  // ❌ No maximum limit enforced
    .execute()

val lines = logs.split("\n")  // ❌ Can load gigabytes into memory
```

**Attack Scenario:**
```bash
# Attacker requests 10 million lines
curl "https://dashboard/pod-logs-local?pod=example&namespace=default&tailLines=10000000"

# Backend attempts to load entire log history into memory → OOM crash
```

**Risk:**
- Memory exhaustion (OOM kill)
- Service unavailability
- Impact on other namespaces/users

**Fix:**
Add maximum limit validation:

```kotlin
// Routes.kt:657,687
val tailLines = call.request.queryParameters["tailLines"]?.toIntOrNull()?.let { requested ->
    when {
        requested < 1 -> 100  // Default for invalid values
        requested > 10000 -> 10000  // Cap at 10k lines
        else -> requested
    }
} ?: 100  // Default

// OR return 400 Bad Request if exceeds limit:
val tailLines = call.request.queryParameters["tailLines"]?.toIntOrNull() ?: 100
if (tailLines > 10000) {
    val payload = json.encodeToString(ErrorResponse("tailLines must be <= 10000"))
    call.respondText(payload, contentType = ContentType.Application.Json, status = HttpStatusCode.BadRequest)
    return@get
}
```

**Recommended limit:** 10,000 lines (reasonable for debugging, prevents abuse)

---

### 2. [MEDIUM] Potential Denial of Service via Unbounded Replicas Count

**Location:** `/src/main/kotlin/org/example/k8s/K8sServiceReader.kt:1287`

**Issue:** The `replicas` parameter only validates `>= 0` but has no upper bound. An attacker could scale a deployment to millions of replicas, exhausting cluster resources.

**Evidence:**
```kotlin
// K8sServiceReader.kt:1287-1296
fun scaleDeployment(deploymentName: String, namespace: String, replicas: Int): ScaleResponse {
    // Validate replicas count
    if (replicas < 0) {  // ✅ Lower bound validated
        return ScaleResponse(...)
    }
    // ❌ No upper bound validation - can request 999999 replicas

    currentScale.spec?.replicas = replicas
    appsApi.replaceNamespacedDeploymentScale(deploymentName, namespace, currentScale).execute()
}
```

**Attack Scenario:**
```bash
# Attacker scales deployment to 100,000 replicas
curl -X POST "https://dashboard/scale-deployment-local" \
  -d '{"deploymentName":"api","namespace":"prod","replicas":100000}'

# Kubernetes attempts to create 100,000 pods → cluster resource exhaustion
```

**Risk:**
- Cluster resource exhaustion (CPU, memory, IP addresses)
- Node overload and crashes
- Impact on all cluster workloads
- Cloud cost explosion (100k pods = $$$$)

**RBAC Mitigation (Partial):**
The RBAC configuration in `k8s/deployment-dev.yaml:113-116` only grants `patch` permission on `deployments/scale`, which is correctly restrictive. However, this doesn't prevent authenticated users from scaling to unreasonable values.

**Fix:**
Add reasonable upper bound:

```kotlin
// K8sServiceReader.kt:1287
fun scaleDeployment(deploymentName: String, namespace: String, replicas: Int): ScaleResponse {
    // Validate replicas count
    when {
        replicas < 0 -> {
            return ScaleResponse(
                success = false,
                message = "Replica count must be >= 0",
                deploymentName = deploymentName,
                namespace = namespace,
                previousReplicas = null,
                newReplicas = replicas
            )
        }
        replicas > 100 -> {  // Add upper bound
            return ScaleResponse(
                success = false,
                message = "Replica count must be <= 100 (requested: $replicas)",
                deploymentName = deploymentName,
                namespace = namespace,
                previousReplicas = null,
                newReplicas = replicas
            )
        }
    }

    // Proceed with scaling...
}
```

**Recommended limit:** 50-100 replicas (adjust based on cluster capacity and use case)

**Alternative:** Implement per-deployment or per-namespace limits based on resource quotas.

---

### 3. [MEDIUM] Kubernetes Field Selector Injection in Pod Events

**Location:** `/src/main/kotlin/org/example/k8s/K8sServiceReader.kt:1000`

**Issue:** The `podName` parameter is directly interpolated into a Kubernetes field selector without validation. Special characters could potentially bypass filtering or cause unexpected behavior.

**Evidence:**
```kotlin
// K8sServiceReader.kt:999-1001
val eventList = coreApi.listNamespacedEvent(namespace)
    .fieldSelector("involvedObject.name=$podName")  // ❌ Direct interpolation
    .execute()
```

**Potential Attack:**
```bash
# Malicious pod name with field selector syntax
podName = "malicious,involvedObject.namespace=kube-system"

# Results in:
# fieldSelector="involvedObject.name=malicious,involvedObject.namespace=kube-system"
# This might return events from kube-system namespace instead
```

**Risk:**
- Information disclosure (events from other namespaces)
- Filter bypass
- Unexpected behavior

**Current Mitigation:**
Kubernetes pod names follow DNS-1123 subdomain rules (lowercase alphanumeric, `-`, `.`), so commas and `=` are invalid. The Kubernetes API itself will reject invalid pod names, providing some protection.

**Fix (Defense in Depth):**
Add explicit validation:

```kotlin
// K8sServiceReader.kt:993
fun fetchPodEvents(podName: String, namespace: String = resolveCurrentNamespace()): List<PodEvent> {
    // Validate pod name format (DNS-1123 subdomain)
    val validPodNameRegex = Regex("^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$")
    if (!podName.matches(validPodNameRegex)) {
        throw IllegalArgumentException("Invalid pod name format: $podName")
    }

    return try {
        val eventList = coreApi.listNamespacedEvent(namespace)
            .fieldSelector("involvedObject.name=$podName")
            .execute()
        // ...
    }
}
```

**Alternative:** Use parameterized queries if available in the Kubernetes client library (currently not exposed).

---

### 4. [MEDIUM] Sensitive Data Exposure in Pod Logs

**Location:** `/src/main/kotlin/org/example/k8s/K8sServiceReader.kt:1050-1056`

**Issue:** Pod logs are fetched and displayed without any sanitization. Logs may contain sensitive data (passwords, tokens, API keys, PII) that should not be exposed through the dashboard.

**Evidence:**
```kotlin
// K8sServiceReader.kt:1050-1056
val logs = coreApi.readNamespacedPodLog(podName, namespace)
    .container(actualContainerName)
    .tailLines(tailLines)
    .execute()  // ❌ Raw logs with no filtering

return PodLogsResponse(
    podName = podName,
    containerName = actualContainerName,
    namespace = namespace,
    logs = logs,  // ❌ Directly exposed to frontend
    // ...
)
```

**Example Sensitive Data in Logs:**
```
INFO: Connecting to database with password: SuperSecret123
DEBUG: API Key: sk-1234567890abcdef
ERROR: Authentication failed for user@example.com with token eyJhbGc...
WARNING: Credit card processed: 4532-1234-5678-9012
```

**Risk:**
- Credential exposure
- PII leakage (GDPR violation)
- Compliance violations (PCI-DSS, HIPAA)
- Insider threat (unauthorized access to sensitive data)

**Current Mitigation:**
RBAC permissions limit log access to authenticated users with `pods/log` read permission. However, this doesn't prevent authorized users from seeing sensitive data they shouldn't access.

**Fix:**
Implement log sanitization (regex-based redaction):

```kotlin
private fun sanitizeLogs(logs: String): String {
    var sanitized = logs

    // Redact common sensitive patterns
    val patterns = listOf(
        Regex("(password|passwd|pwd)[\\s:=]+[^\\s]+", RegexOption.IGNORE_CASE) to "\\1: [REDACTED]",
        Regex("(api[_-]?key|apikey)[\\s:=]+[^\\s]+", RegexOption.IGNORE_CASE) to "\\1: [REDACTED]",
        Regex("(token|bearer)[\\s:=]+[a-zA-Z0-9._-]{20,}", RegexOption.IGNORE_CASE) to "\\1: [REDACTED]",
        Regex("(secret|auth)[\\s:=]+[^\\s]+", RegexOption.IGNORE_CASE) to "\\1: [REDACTED]",
        // Credit cards
        Regex("\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b") to "[REDACTED-CC]",
        // Email addresses (if considered PII)
        Regex("[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}") to "[REDACTED-EMAIL]",
    )

    patterns.forEach { (pattern, replacement) ->
        sanitized = pattern.replace(sanitized, replacement)
    }

    return sanitized
}

fun fetchPodLogs(...): PodLogsResponse {
    // ... fetch logs ...
    val sanitizedLogs = sanitizeLogs(logs)

    return PodLogsResponse(
        logs = sanitizedLogs,  // ✅ Sanitized
        // ...
    )
}
```

**Note:** This is defense-in-depth. The primary fix should be ensuring applications don't log sensitive data in the first place.

**Alternative:** Add warning banner in UI: "Pod logs may contain sensitive data. Use responsibly."

---

## Low Priority Issues (Fix when convenient)

### 1. [LOW] Missing Rate Limiting on Log Fetch Endpoints

**Location:** `/src/main/kotlin/org/example/routes/Routes.kt:653-714`

**Issue:** Pod logs endpoints have no rate limiting. An attacker could spam requests to cause excessive API calls to Kubernetes, impacting cluster performance.

**Risk:**
- API server overload
- Metrics-server impact
- Network bandwidth consumption

**Fix:**
Implement per-IP or per-user rate limiting using a Spring HandlerInterceptor:

```kotlin
install(RateLimiting) {
    register("logs") {
        rateLimiter(limit = 10, refillPeriod = 60.seconds)
    }
}

routing {
    rateLimit("logs") {
        get("/pod-logs") { ... }
        get("/pod-logs-local") { ... }
    }
}
```

**Recommended limit:** 10 requests per minute per user/IP

---

### 2. [LOW] Namespace Parameter Not Validated Against Allowed Namespaces

**Location:** Multiple endpoints (all `-local` variants)

**Issue:** The `namespace` parameter is accepted without validation against a whitelist of allowed namespaces. While RBAC provides protection, additional validation would provide defense-in-depth.

**Evidence:**
```kotlin
// Routes.kt:554,618,684,722,754,786
val namespace = call.request.queryParameters["namespace"]?.trim().orEmpty()
// ❌ No validation against allowed namespaces
```

**Risk:**
- Low risk due to RBAC protection (Role is namespace-scoped)
- Potential for enumeration attacks (testing namespace existence)
- UI confusion if invalid namespaces are accepted

**Current Mitigation:**
Kubernetes RBAC will reject unauthorized namespace access. The Role in `k8s/deployment-dev.yaml` is namespace-scoped to `your-namespace`, preventing cross-namespace access.

**Fix (Optional):**
Add namespace validation against environment config:

```kotlin
// AppConfig.kt
val ALLOWED_NAMESPACES = listOf("your-namespace", "default")

// Routes.kt
if (namespace.isNotBlank() && !ALLOWED_NAMESPACES.contains(namespace)) {
    val payload = json.encodeToString(ErrorResponse("Namespace not allowed: $namespace"))
    call.respondText(payload, contentType = ContentType.Application.Json, status = HttpStatusCode.Forbidden)
    return@get
}
```

---

## Security Features Working Correctly

### 1. [VERIFIED] XSS Protection - All User Input Properly Escaped

**Verified Locations:**
- `/src/main/resources/dashboard/js/modules/ui-components.js:13-17` - `escapeHtml()` function
- Multiple render functions use `escapeHtml()` on all dynamic content

**Evidence:**
```javascript
// ui-components.js:13-17
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');  // ✅ textContent auto-escapes
  return div.innerHTML;
}

// ui-components.js:662,669,695-696,716,771,808,861,863,912-913
const clusterIp = escapeHtml(endpointsData.clusterIp || 'None');
const portsHtml = ports.map(p => `<code>${escapeHtml(p.name || 'unnamed')}</code>`).join(' ');
const podName = escapeHtml(ep.podName || 'n/a');
const url = escapeHtml(url);
const message = escapeHtml(event.message || 'No message');
const containerName = escapeHtml(c);
```

**Testing:**
All user-controlled data (pod names, namespaces, service names, log lines, event messages, config keys/values) is escaped before insertion into HTML via `innerHTML`.

**Conclusion:** XSS protection is properly implemented. No changes needed.

---

### 2. [VERIFIED] Secret Values Never Exposed - Only Keys Returned

**Verified Locations:**
- `/src/main/kotlin/org/example/k8s/K8sServiceReader.kt:1236-1257`
- `/src/main/resources/dashboard/js/modules/ui-components.js:1145-1178`

**Evidence (Backend):**
```kotlin
// K8sServiceReader.kt:1236-1249
fun fetchSecretKeys(name: String, namespace: String): SecretData {
    return try {
        val secret = coreApi.readNamespacedSecret(name, namespace).execute()
        // Extract ONLY keys, never values!  ✅✅✅
        val keys = secret.data?.keys?.toList() ?: emptyList()

        SecretData(
            name = name,
            namespace = namespace,
            keys = keys  // ✅ Only key names, no values
        )
    }
}
```

**Evidence (Frontend):**
```javascript
// ui-components.js:1169-1174
${data.keys.map(key => `
  <tr>
    <td><code class="config-key">${escapeHtml(key)}</code></td>
    <td><span class="masked-value">••••••••</span></td>  <!-- ✅ Always masked -->
  </tr>
`).join('')}
```

**Conclusion:** Secrets are correctly handled. Only key names are exposed, values are never transmitted or displayed.

---

### 3. [VERIFIED] RBAC Permissions Follow Least Privilege Principle

**Verified Locations:**
- `/k8s/deployment-dev.yaml:63-121` (Role definition)
- `/k8s/deployment-prod.yaml:63-121` (identical)

**Evidence:**
```yaml
# k8s/deployment-dev.yaml:68-121
rules:
  # ✅ Read-only access to core resources
  - apiGroups: [""]
    resources: ["services", "pods", "events", "endpoints", "configmaps", "secrets"]
    verbs: ["get", "list", "watch"]  # No create/delete

  # ✅ Logs are read-only
  - apiGroups: [""]
    resources: ["pods/log"]
    verbs: ["get"]

  # ✅ Scale deployments: only patch on deployments/scale subresource
  - apiGroups: ["apps"]
    resources: ["deployments", "deployments/scale"]
    verbs: ["get", "list", "watch", "patch"]  # No delete, no update (only patch for scale)

  # ✅ Networking read-only
  - apiGroups: ["networking.k8s.io"]
    resources: ["ingresses"]
    verbs: ["get", "list"]
```

**Analysis:**
- No `create`, `delete`, or `deletecollection` verbs
- No cluster-wide permissions (Role, not ClusterRole)
- Scoped to single namespace (your-namespace)
- Scale operation limited to `patch` on `deployments/scale` subresource (cannot modify other deployment fields)
- Secrets access is read-only (and backend only returns keys)

**Conclusion:** RBAC follows least privilege. Well designed.

---

### 4. [VERIFIED] Input Validation on Required Parameters

**Verified Locations:**
- All endpoints validate required parameters exist before processing

**Evidence:**
```kotlin
// Routes.kt:529-533, 589-596, 654-663, etc.
if (serviceName.isBlank()) {
    val payload = json.encodeToString(ErrorResponse("Missing required query param: service"))
    call.respondText(payload, contentType = ContentType.Application.Json, status = HttpStatusCode.BadRequest)
    return@get
}

// Routes.kt:825-827
if (request.deploymentName.isBlank() || request.namespace.isBlank()) {
    throw IllegalArgumentException("Missing required fields: deploymentName, namespace")
}
```

**Conclusion:** Required parameter validation is properly implemented.

---

## Recommendations

### General Security Improvements

1. **Implement Structured Audit Logging**
   - Add audit logs for all write operations (scale deployment)
   - Include: timestamp, user, action, resource, old/new state, result
   - Consider centralized log aggregation (Elasticsearch, Splunk)

2. **Add Resource Limits**
   - Cap `tailLines` parameter (max 10,000)
   - Cap `replicas` parameter (max 50-100)
   - Consider per-user rate limiting

3. **Sanitize Pod Logs**
   - Redact sensitive patterns (passwords, tokens, API keys)
   - Add UI warning about sensitive data
   - Consider role-based log access controls

4. **Input Validation Hardening**
   - Validate pod names against DNS-1123 format
   - Validate namespace names against allowed list
   - Sanitize all string inputs

5. **Monitoring and Alerting**
   - Alert on excessive scale operations
   - Alert on high-frequency log fetches
   - Monitor for unusual namespace access patterns

---

## Testing Recommendations

### Security Test Cases

1. **XSS Tests:**
   ```bash
   # Verify these are escaped in UI:
   podName="<script>alert('xss')</script>"
   message="<img src=x onerror=alert(1)>"
   namespace="'; DROP TABLE pods; --"
   ```

2. **DoS Tests:**
   ```bash
   # Test tailLines limit
   curl "/pod-logs-local?pod=test&namespace=default&tailLines=999999999"

   # Test replicas limit
   curl -X POST "/scale-deployment-local" -d '{"replicas":999999,...}'
   ```

3. **Injection Tests:**
   ```bash
   # Test field selector injection
   podName="test,involvedObject.namespace=kube-system"

   # Test namespace traversal
   namespace="../kube-system"
   ```

4. **Secret Exposure Tests:**
   ```bash
   # Verify secret values are never in response
   curl "/secret-keys-local?name=db-secret&namespace=default" | grep -i "password\|key\|token"
   ```

---

## Compliance Considerations

### GDPR
- **Pod Logs:** May contain PII (emails, names, IPs) → Implement sanitization
- **Audit Logs:** Required for data access tracking → Implement audit logging

### SOC2
- **Access Control:** ✅ Implemented via RBAC
- **Audit Trails:** ❌ Missing for write operations (scale deployment)
- **Change Management:** ❌ No approval workflow for scaling

### PCI-DSS
- **Logging:** ❌ Sensitive data may appear in pod logs
- **Access Control:** ✅ Implemented via RBAC
- **Encryption:** ✅ Data at rest (Kubernetes secrets) and in transit (HTTPS)

---

## Conclusion

The new features are generally well-implemented with proper XSS protection, secret handling, and RBAC. The main security gaps are:

1. **Missing audit logging** for write operations (High priority)
2. **Unbounded parameters** allowing DoS attacks (Medium priority)
3. **Sensitive data in logs** without sanitization (Medium priority)

**Overall assessment:** The application is production-ready after addressing the High priority issue (audit logging). Medium and Low priority issues should be addressed in the next sprint.

**Estimated remediation time:**
- High priority: 2-4 hours
- Medium priority: 4-8 hours
- Low priority: 2-4 hours
- **Total:** 8-16 hours of development work

---

**Auditor:** Security Guardian Agent (Claude Sonnet 4.5)
**Review Status:** Complete
**Next Review:** After implementing High priority fixes
