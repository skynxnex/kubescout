# Project: Kubescout - Kubernetes Service Summary

## Overview

Kubescout (Kubernetes Service Summary) is a Kubernetes service monitoring dashboard built with:
- **Backend**: Kotlin + Spring Boot (RESTful API)
- **Frontend**: Vue 3 (CDN, Composition API), HTML5, CSS3
- **Purpose**: Monitor Kubernetes services, pods, and resource usage with a visual dashboard

The application provides real-time monitoring of Kubernetes services with features like:
- Service health status with color-coded indicators
- Pod-level resource details (CPU, memory)
- Auto-refresh every 60 seconds
- Multiple visual themes with animated backgrounds
- Dedicated view for problematic pods
- Integration with log platforms (Humio/LogScale, Grafana, Datadog) for log links

## Architecture

```
kss/
├── src/main/
│   ├── kotlin/org/example/
│   │   ├── Application.kt                    # Spring Boot application entry point
│   │   ├── routes/
│   │   │   ├── Routes.kt                     # Shared helpers + registerRoutes()
│   │   │   ├── ServiceRoutes.kt              # /services, /services-local, /namespaces-local, /contexts-local
│   │   │   ├── PodRoutes.kt                  # /service-pods*, /pod-events*, /pod-logs*, /pod-containers*, /problematic-pods-local
│   │   │   ├── ConfigRoutes.kt               # /service-configs*, /configmap-data*, /secret-keys*, /secret-value*, /service-endpoints*
│   │   │   ├── DeploymentRoutes.kt           # /scale-deployment*, /rollback-deployment*, /restart-deployment*, /deployment-history*
│   │   │   ├── WebSocketRoutes.kt            # WebSocket: /pod-shell*, /pod-logs-stream-local, /service-logs-stream-local (CSRF-protected)
│   │   │   └── DashboardRoutes.kt            # Dashboard HTML pages
│   │   ├── k8s/
│   │   │   ├── K8sServiceReader.kt           # Kubernetes API client
│   │   │   ├── K8sServiceReaderFactory.kt    # Caches readers per context (ConcurrentHashMap)
│   │   │   └── MetricsCache.kt               # Short-lived cache for K8s metrics-server responses
│   │   ├── ratelimit/
│   │   │   ├── RateLimiter.kt                # Per-IP sliding-window rate limiter
│   │   │   └── RateLimitPlugin.kt            # Spring Boot interceptor wiring
│   │   ├── view/DashboardViewRenderer.kt     # Renders dashboard HTML with injected config
│   │   ├── config/AppConfig.kt               # Environment configuration
│   │   └── model/Models.kt                   # Data models
│   └── resources/
│       └── dashboard/              # Frontend static files
│           ├── index.html          # Main dashboard (local + in-cluster)
│           ├── problematic-pods.html
│           ├── css/
│           │   ├── shared/base.css # Core styles
│           │   └── themes/         # Theme-specific CSS (one file per theme)
│           └── js/
│               ├── vue-app.js              # Vue 3 app entry point (main dashboard)
│               ├── problematic-pods-app.js # Vue 3 app entry point (problematic pods page)
│               ├── main.js                 # Legacy/shared bootstrap (still used)
│               ├── stores/
│               │   ├── dashboardStore.js   # Pinia-style reactive store
│               │   └── themeStore.js
│               ├── components/             # Vue 3 SFC-style components (CDN)
│               │   ├── ServiceRow.js, ServiceTable.js, FilterControls.js
│               │   ├── ThemeAnimations.js  # Manages canvas animations per theme
│               │   ├── PodLogsViewer.js, ServiceLogsViewer.js
│               │   ├── ShellModal.js, PodShell.js
│               │   └── ... (AuthError, ConfirmModal, LegendModal, etc.)
│               ├── modules/
│               │   ├── incremental-updates.js
│               │   ├── matrix-rain.js      # Matrix digital rain canvas animation
│               │   ├── starfield.js        # Star Wars starfield animation
│               │   ├── autumn-leaves.js    # Autumn leaves animation
│               │   ├── deployment-handlers.js, scale-handlers.js
│               │   ├── log-handlers.js, shell-handlers.js
│               │   └── ...
│               └── utils/
│                   ├── sharedUtils.js
│                   └── serviceDiff.js
├── k8s/                            # Kubernetes manifests
├── scripts/                        # Deploy scripts
└── Dockerfile                      # Multi-stage build (runs as non-root user)
```

## API Endpoints

### Service & Namespace
- `GET /services` - List services in current namespace (in-cluster)
- `GET /services-local` - List services via kubeconfig (local mode)
- `GET /namespaces-local` - List namespaces via kubeconfig
- `GET /contexts-local` - List available kubeconfig contexts

### Pod Operations
- `GET /service-pods` - Pod resource details for a service (in-cluster)
- `GET /service-pods-local` - Pod resource details via kubeconfig
- `GET /service-pods-batch` - Batch pod details for multiple services (in-cluster)
- `GET /service-pods-local-batch` - Batch pod details via kubeconfig
- `GET /pod-events` - Events for a service (in-cluster)
- `GET /pod-events-local` - Events for a service via kubeconfig
- `GET /pod-logs` - Recent log lines for a pod/container (in-cluster)
- `GET /pod-logs-local` - Recent log lines via kubeconfig
- `GET /pod-containers` - List containers in a pod (in-cluster)
- `GET /pod-containers-local` - List containers via kubeconfig
- `GET /problematic-pods-local` - All problematic pods in namespace

### Config & Secrets
- `GET /service-configs` - List ConfigMaps and Secrets for a service (in-cluster)
- `GET /service-configs-local` - List ConfigMaps and Secrets via kubeconfig
- `GET /configmap-data` - ConfigMap key/value data (in-cluster)
- `GET /configmap-data-local` - ConfigMap key/value data via kubeconfig
- `GET /secret-keys` - Secret key names, values not exposed (in-cluster)
- `GET /secret-keys-local` - Secret key names via kubeconfig
- `GET /secret-value` - Single secret value (in-cluster)
- `GET /secret-value-local` - Single secret value via kubeconfig
- `GET /service-endpoints` - Service endpoints and Ingress rules (in-cluster)
- `GET /service-endpoints-local` - Service endpoints and Ingress rules via kubeconfig

### Deployment Operations (mutating — require `X-Requested-By: kss` header)
- `GET /deployment-history` - Rollout history for a deployment (in-cluster)
- `GET /deployment-history-local` - Rollout history via kubeconfig
- `POST /scale-deployment` - Scale a deployment or HPA (in-cluster)
- `POST /scale-deployment-local` - Scale via kubeconfig
- `POST /rollback-deployment` - Roll back to a previous revision (in-cluster)
- `POST /rollback-deployment-local` - Roll back via kubeconfig
- `POST /restart-deployment` - Rolling restart of a deployment (in-cluster)
- `POST /restart-deployment-local` - Rolling restart via kubeconfig

### WebSocket (CSRF-protected: Origin must match Host / localhost)
- `WS /pod-shell` - Interactive exec terminal into a pod (in-cluster)
- `WS /pod-shell-local` - Interactive exec terminal via kubeconfig
- `WS /pod-logs-stream-local` - Real-time log streaming for a single pod
- `WS /service-logs-stream-local` - Real-time log streaming for all pods of a service

### Health & Dashboard Pages
- `GET /health` - Returns `OK`
- `GET /` - Main dashboard (in-cluster mode)
- `GET /dashboard-local` - Main dashboard (local mode)
- `GET /problematic-pods` - Problematic pods view

## Code Conventions

### Kotlin Backend
- Use Kotlin idioms (data classes, extension functions, null safety)
- Kotlinx.serialization for JSON
- Kubernetes client-java for K8s API
- Error handling: Use try-catch with friendly error messages for users
- AWS SSO auth errors: Provide clear instructions with retry button

### Frontend JavaScript
- **Vue 3 (CDN, Composition API)** — loaded via `<script src="https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js">`
- ES6 modules with imports/exports; `vue-app.js` is the main entry point for the dashboard
- Components live in `js/components/`, reactive stores in `js/stores/`, canvas animations in `js/modules/`
- Prefix console.log with module identifier: `console.log('[Module Name] message')`
- Use `const` and `let`, never `var`
- Keep functions pure and modular

### CSS
- BEM-like naming: `.component-name`, `.component-name__element`, `.component-name--modifier`
- CSS custom properties (variables) for theming
- Each theme in separate file under `css/themes/`
- Responsive design: mobile-first approach

### HTML
- Semantic HTML5 elements
- Accessibility: aria-labels, proper heading hierarchy
- Language: `lang="en"`

## Themes System

6 themes available: Cyberpunk, Summer, Star Wars, Matrix, Autumn, Crimson

### Adding a New Theme
1. Create `css/themes/your-theme.css`
2. Define CSS variables for colors
3. Add theme option in `index.html` and `problematic-pods.html`
4. Optional: Add canvas animation in `js/modules/` (see `matrix-rain.js`, `starfield.js`, `autumn-leaves.js`)
5. Wire the animation into `js/components/ThemeAnimations.js`
6. Test theme switching and persistence

### Theme Structure
```css
:root[data-theme="your-theme"] {
  --bg-primary: #...;
  --text-primary: #...;
  --color-danger: #...;
  /* etc */
}
```

## Common Tasks

### Adding a New API Endpoint
1. Add route handler in the appropriate file under `src/main/kotlin/org/example/routes/` (ServiceRoutes, PodRoutes, ConfigRoutes, DeploymentRoutes, or a new file)
2. Register it via `registerRoutes()` in `Routes.kt` if you added a new file
3. Add data model in `Models.kt` if needed
4. Add business logic in `K8sServiceReader.kt` if K8s-related
5. Mutating endpoints (POST) must call `requireCsrfHeader(call)` and check the result
6. Test with both in-cluster and local modes

### Adding Frontend Feature
1. Create a Vue 3 component in `js/components/` or add logic to the relevant store in `js/stores/`
2. Import and register the component in `vue-app.js` or `problematic-pods-app.js`
3. Add CSS in `css/shared/base.css` or theme files
4. Ensure it works with all themes
5. Test auto-refresh compatibility

### Modifying Service Status Logic
- Status logic lives in the Vue component `js/components/ServiceRow.js` (and `js/components/serviceUtils.js`)
- The incremental update path is in `js/modules/incremental-updates.js` (`getStatusForService()`)
- Both must produce the same CSS class names: `row-bad`, `row-warn`, or `''`

### Auto-Reload System
- Located in `js/modules/incremental-updates.js`
- Runs every 60 seconds with a visible countdown in the UI
- Uses hash comparison to detect changes
- Only updates changed services (incremental)
- Preserves expanded state during updates

## Development Workflow

### Local Development
```bash
# Start dev container with hot-reload
yarn up-dev

# Access at http://localhost:8081
# Changes in src/ auto-reload
```

### Building
```bash
# Build JAR
mvn package

# Build Docker (runtime)
docker build --target runtime -t kubescout .

# Build multi-arch for EKS
yarn push
```

### Testing
- Manual testing via dashboard UI
- Test both local mode and in-cluster simulation
- Test all themes
- Test auto-refresh with changing data
- Test AWS auth error handling

## Deployment

### Dev Environment
```bash
./scripts/deploy-dev.sh
```

### Prod Environment
```bash
./scripts/deploy-prod.sh
```

### Manual Deploy
```bash
yarn push
kubectl apply -f k8s/deployment-dev.yaml
kubectl rollout restart deployment/kss -n your-namespace
```

## Environment Variables

### Required for Local Mode
- `LOCAL_MODE=true` - Enable local kubeconfig mode
- `LOCAL_NAMESPACE=namespace` - Default namespace

### Optional Configuration
- `LOCAL_KUBE_CONTEXT=context-name` - Kubeconfig context
- `DEV_NAMESPACE`, `DEV_KUBE_CONTEXT` - Dev preset
- `PROD_NAMESPACE`, `PROD_KUBE_CONTEXT` - Prod preset
- `LOG_PROVIDER` - Log platform: `humio`, `grafana`, or `datadog` (leave empty to disable log links)
- `LOG_BASE_URL` - Base URL for your log platform
- `LOG_REPO` - Repository/index name (Humio only)
- `LOG_DATASOURCE` - Datasource name (Grafana only, default: `Loki`)
- `LOG_TZ` - Timezone for log queries (default: `UTC`)
- `LOG_START` - Lookback window for log queries (default: `7d`)
- `LOG_NAMESPACE` - Namespace filter injected into log queries
- `DASHBOARD_RESTART_RED_THRESHOLD=3` - Restart count for red status
- `MAX_REPLICAS=50` - Upper bound for scale-deployment operations

## Known Patterns

### Status Color Logic
- **Red (Bad)**: `readyCount < podCount AND restartCount > 0` OR has OOMKilled/Error
- **Yellow (Warning)**: `restartCount >= THRESHOLD` OR has Completed containers
- **Green (Healthy)**: Everything else
- **Blue background**: `podCount == 1` (single pod risk indicator)

### Namespace Handling
- Backend returns actual namespace in API responses
- Frontend uses namespace from API response (not input field)
- Pod log links use pod's actual namespace (not global config)

### Error Messages
- AWS auth errors: Clear instructions with "Retry" button
- 401/403: Assume AWS SSO token expired
- Always provide user-friendly error messages

## Agent Preferences

Use these specialized agents for different tasks:

- **backend-developer**: Kotlin/Spring Boot backend changes, API endpoints, K8s client logic
- **frontend-design-developer**: UI/UX changes, new themes, CSS styling, HTML structure
- **code-pathfinder**: Understanding code flows, tracing bugs, exploring architecture
- **test-and-lint-enforcer**: Code quality checks before commit
- **security-guardian**: Security audits, dependency updates, authentication changes

## Testing Checklist

Before committing major changes:
- [ ] Test both `/` (in-cluster) and `/dashboard-local`
- [ ] Test all 6 themes
- [ ] Test service expansion (pod details)
- [ ] Test auto-refresh (wait 60s or trigger manually)
- [ ] Test pod log streaming (WebSocket)
- [ ] Test exec terminal (pod shell, WebSocket)
- [ ] Test problematic pods view
- [ ] Test with different namespaces
- [ ] Test AWS auth error flow (if applicable)
- [ ] Verify no console errors
- [ ] Check responsive design (mobile/tablet)

## Recent Changes

- Frontend migrated from vanilla JS to **Vue 3 CDN** (Composition API, reactive stores, component-per-file)
- Frontend JS reorganised: `vue-app.js` entry point, `js/stores/`, `js/components/`, `js/modules/`
- New endpoints: `/contexts-local`, batch pod endpoints (`/service-pods-batch`, `/service-pods-local-batch`), `/pod-containers[-local]`, `/secret-value[-local]`, `/service-endpoints[-local]`, `/deployment-history[-local]`, `/rollback-deployment[-local]`, `/restart-deployment[-local]`, `/scale-deployment` (in-cluster)
- New WebSocket endpoints: `/pod-shell` (in-cluster exec), `/pod-shell-local`, `/pod-logs-stream-local`, `/service-logs-stream-local`
- Exec terminal (pod shell) added to WebSocketRoutes; WebSocketRoutes is no longer only log streaming
- Rate limiting plugin added (`ratelimit/` package)
- `DashboardViewRenderer` extracted to `view/` package for rendering HTML with injected config
- Routes.kt split into focused files: ServiceRoutes, PodRoutes, ConfigRoutes, DeploymentRoutes, WebSocketRoutes, DashboardRoutes
- K8sServiceReaderFactory added — caches readers per kubeconfig context (ConcurrentHashMap)
- AppConfig gained `maxReplicas` (env: `MAX_REPLICAS`, default 50) and multi-provider log config (`LOG_PROVIDER`, `LOG_BASE_URL`, `LOG_REPO`, `LOG_DATASOURCE`, `LOG_TZ`, `LOG_START`, `LOG_NAMESPACE`; `HUMIO_*` vars still accepted as fallback)
- In-cluster dashboard now served at `/` (not `/dashboard`) to avoid static file route conflict
- Security: WebSocket CSRF protection (Origin validated against Host / localhost regex), non-root user in Dockerfile, error messages sanitized before HTTP responses, `tailLines`/`sinceSeconds` have upper bounds, mutating POST routes require `X-Requested-By: kss` header
- One ApiClient per K8sServiceReader; blocking K8s calls wrapped in `withContext(Dispatchers.IO)`; `println` replaced with logger
- Prod/Dev environment tag per context stored in localStorage; auto-refresh countdown visible in UI

## Performance Considerations

- Canvas animations optimized for ~60 FPS
- Auto-refresh uses incremental updates (only changed services)
- Metrics cache reduces load on K8s metrics-server
- Expanded pods load on-demand (not eagerly)

## Security Notes

- In-cluster mode uses ServiceAccount with minimal RBAC
- Local mode requires valid kubeconfig/AWS credentials
- No secrets in code or config files
- imagePullSecrets reference external secret
- WebSocket endpoints validate Origin against Host header (in-cluster) or a strict localhost regex (local mode) — prevents CSWSH
- Mutating POST endpoints require the `X-Requested-By: kss` CSRF header
- Error messages are sanitized before returning to HTTP clients (internal URLs and IPs redacted)
- Container runs as non-root user
- `tailLines` and `sinceSeconds` query params have enforced upper bounds

## Documentation

- README.md - Full project documentation
- THEMES.md - Theme and animation documentation
- DEV-AUTO-RELOAD.md - Auto-refresh implementation details
- This file (CLAUDE.md) - AI assistant context
