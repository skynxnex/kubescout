# Kubescout — Kubernetes Service Summary

[![Docker Hub](https://img.shields.io/docker/pulls/skynxnex/kubescout?label=Docker%20Hub&logo=docker)](https://hub.docker.com/r/skynxnex/kubescout)
[![Image Size](https://img.shields.io/docker/image-size/skynxnex/kubescout/latest)](https://hub.docker.com/r/skynxnex/kubescout)

Kubescout is a Kotlin/Spring Boot dashboard for monitoring Kubernetes services, pods, and resource usage. It provides a visual overview of service health, pod-level CPU/memory details, auto-refresh every 60 seconds, and a suite of operational tools including pod log streaming, events timeline, deployment rollback, an exec terminal, ConfigMap/Secret viewer, and service endpoint/ingress inspection — all served through a browser UI with six visual themes and animated backgrounds. Log platform links (Humio/LogScale, Grafana, Datadog) can be enabled via the `LOG_*` environment variables.

## Getting Started (locally)

### Prerequisites

- **Docker + Docker Compose** — [install Docker Desktop](https://www.docker.com/products/docker-desktop/)
- **Yarn** — used to run the compose scripts (`npm install -g yarn`)
- **kubectl** — configured with access to your cluster
  ```bash
  kubectl version --client   # verify installation
  kubectl get pods -n your-namespace  # verify cluster access
  ```
- **AWS SSO** — valid session required for EKS clusters
  ```bash
  aws sso login
  aws sts get-caller-identity  # verify credentials
  ```
- **kubeconfig** — context pointing at your cluster (`~/.kube/config` is mounted automatically)

### 1. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — at minimum set:

```bash
LOCAL_MODE=true
LOCAL_NAMESPACE=your-namespace
LOCAL_KUBE_CONTEXT=your-context-name
```

### 2. Start dev server

```bash
yarn up-dev
```

Dashboard available at http://localhost:8081

### 3. Make changes

Edit files in `src/` — the container detects changes and rebuilds (~10 seconds).

```bash
yarn logs-dev   # follow container logs
yarn stop       # stop all containers
```

## Features

- 6 visual themes with animated backgrounds (Matrix digital rain, falling autumn leaves, Star Wars starfield)
- Service health indicators color-coded by pod readiness and restart count
- Pod-level CPU/memory usage, requests, and limits
- Auto-refresh every 60 seconds (incremental — only changed rows update)
- Pod log streaming in the browser
- Pod events timeline
- Deployment rollback modal with revision comparison
- Exec terminal into running pods
- ConfigMap and Secret viewer
- Service endpoints and Ingress inspection
- HPA (HorizontalPodAutoscaler) display
- Problematic pods view across the namespace

## Configuration

### Required for local mode

| Variable | Description |
|---|---|
| `LOCAL_MODE` | Set to `true` to use kubeconfig instead of in-cluster credentials |
| `LOCAL_NAMESPACE` | Default namespace to query |
| `LOCAL_KUBE_CONTEXT` | kubeconfig context name to use |

### Optional

| Variable | Default | Description |
|---|---|---|
| `DEV_NAMESPACE` | — | Namespace for the Dev preset button in the UI |
| `DEV_KUBE_CONTEXT` | — | kubeconfig context for the Dev preset |
| `PROD_NAMESPACE` | — | Namespace for the Prod preset button in the UI |
| `PROD_KUBE_CONTEXT` | — | kubeconfig context for the Prod preset |
| `LOG_PROVIDER` | — | Log platform: `humio`, `grafana`, or `datadog`. Leave empty to disable log links. |
| `LOG_BASE_URL` | — | Base URL for your log platform |
| `LOG_REPO` | — | Repository/index name (Humio only) |
| `LOG_DATASOURCE` | `Loki` | Datasource name (Grafana only) |
| `LOG_TZ` | `UTC` | Timezone for log queries |
| `LOG_START` | `7d` | Default lookback window |
| `LOG_NAMESPACE` | — | Namespace filter injected into log queries |
| `DASHBOARD_RESTART_RED_THRESHOLD` | `3` | Restart count at which a service row turns red |
| `MAX_REPLICAS` | `50` | Upper bound for scale-deployment operations |

## Yarn Scripts

| Script | Description |
|---|---|
| `yarn up` | Pull latest image from registry and start on port 8080 |
| `yarn up-background` | Same as `yarn up` but detached |
| `yarn up-dev` | Start dev mode on port 8081 (builds from source, hot-reload via Maven) |
| `yarn up-dev-background` | Same as `yarn up-dev` but detached |
| `yarn reload-dev` | Restart the dev container to pick up code changes |
| `yarn logs-dev` | Follow dev container logs (last 200 lines) |
| `yarn stop` | Stop and remove all containers |
| `yarn push` | Build multi-arch image (amd64 + arm64) and push to registry |

`yarn up` always pulls the latest `:master` image from `skynxnex/kubescout`. Run `yarn push` first to publish a new version, then others can pick it up with `yarn up` without building locally. Use `yarn up-dev` for local development with live reload.

## API Endpoints

### Service & Namespace

| Endpoint | Description |
|---|---|
| `GET /health` | Returns `OK` |
| `GET /services` | List services in current namespace (in-cluster mode) |
| `GET /services-local` | List services via kubeconfig (local mode) |
| `GET /namespaces-local` | List namespaces via kubeconfig |
| `GET /contexts-local` | List available kubeconfig contexts |

### Pod Operations

| Endpoint | Description |
|---|---|
| `GET /service-pods` | Pod resource details for a service (in-cluster mode) |
| `GET /service-pods-local` | Pod resource details via kubeconfig |
| `GET /service-pods-batch` | Batch pod details for multiple services (in-cluster) |
| `GET /service-pods-local-batch` | Batch pod details via kubeconfig |
| `GET /pod-events` | Events for a service (in-cluster) |
| `GET /pod-events-local` | Events for a service via kubeconfig |
| `GET /pod-logs` | Recent log lines for a pod/container (in-cluster) |
| `GET /pod-logs-local` | Recent log lines via kubeconfig |
| `GET /pod-containers` | List containers in a pod (in-cluster) |
| `GET /pod-containers-local` | List containers via kubeconfig |
| `GET /problematic-pods-local` | All problematic pods in a namespace |

### Config & Secrets

| Endpoint | Description |
|---|---|
| `GET /service-configs` | List ConfigMaps and Secrets for a service (in-cluster) |
| `GET /service-configs-local` | List ConfigMaps and Secrets via kubeconfig |
| `GET /configmap-data` | ConfigMap key/value data (in-cluster) |
| `GET /configmap-data-local` | ConfigMap key/value data via kubeconfig |
| `GET /secret-keys` | Secret key names — values not exposed (in-cluster) |
| `GET /secret-keys-local` | Secret key names via kubeconfig |
| `GET /secret-value` | Single secret value (in-cluster) |
| `GET /secret-value-local` | Single secret value via kubeconfig |
| `GET /service-endpoints` | Service endpoints and Ingress rules (in-cluster) |
| `GET /service-endpoints-local` | Service endpoints and Ingress rules via kubeconfig |

### Deployment Operations

All mutating endpoints require the `X-Requested-By: kss` header.

| Endpoint | Description |
|---|---|
| `GET /deployment-history` | Rollout history for a deployment (in-cluster) |
| `GET /deployment-history-local` | Rollout history via kubeconfig |
| `POST /scale-deployment` | Scale a deployment or HPA (in-cluster) |
| `POST /scale-deployment-local` | Scale via kubeconfig |
| `POST /rollback-deployment` | Roll back to a previous revision (in-cluster) |
| `POST /rollback-deployment-local` | Roll back via kubeconfig |
| `POST /restart-deployment` | Rolling restart (in-cluster) |
| `POST /restart-deployment-local` | Rolling restart via kubeconfig |

### WebSocket

| Endpoint | Description |
|---|---|
| `WS /pod-shell` | Interactive exec terminal into a pod (in-cluster) |
| `WS /pod-shell-local` | Interactive exec terminal via kubeconfig |
| `WS /pod-logs-stream-local` | Real-time log streaming for a single pod |
| `WS /service-logs-stream-local` | Real-time log streaming for all pods of a service |

### Dashboard Pages

| Endpoint | Description |
|---|---|
| `GET /` | Dashboard UI (in-cluster mode) |
| `GET /dashboard-local` | Dashboard UI (local mode) |
| `GET /problematic-pods` | Problematic pods UI |

## Dashboard Themes

| Theme | Icon | Description | Animation |
|---|---|---|---|
| **Cyberpunk** | Robot | Cyan/magenta neon, futuristic tech | Gradient orbs |
| **Summer** | Sun | Light yellow/pink, beach vibes | Gradient orbs |
| **Star Wars** | Star | Yellow text, deep space, lightsaber glows | Starfield |
| **Matrix** | Green heart | Green-on-black terminal, hacker aesthetic | Digital rain |
| **Autumn** | Leaf | Autumn colors, warm and cozy | Falling leaves |
| **Crimson** | Red circle | Crimson brand colors (#E90017) | Gradient orbs |

All canvas animations are optimized for ~60 FPS at under 5% CPU.

See [THEMES.md](THEMES.md) for full theme documentation.

## Deployment

### Build and push

```bash
yarn push    # builds multi-arch (amd64 + arm64) and pushes to registry
```

### Deploy to Kubernetes

```bash
kubectl apply -f k8s/deployment-dev.yaml
# or
kubectl apply -f k8s/deployment-prod.yaml
```

### Rolling restart (after new image push)

```bash
kubectl rollout restart deployment/kss -n your-namespace
```

The manifests set `imagePullPolicy: Always` so a rollout restart always pulls the latest `:master` tag.

### Deploy scripts

```bash
./scripts/deploy-dev.sh
./scripts/deploy-prod.sh
```

## RBAC

The manifests in `k8s/` define a least-privilege `Role` granting read access to `services`, `pods`, `pods/log`, and `pods/exec` within the namespace. A `ServiceAccount` and `RoleBinding` are included. The `imagePullPolicy: Always` setting and `imagePullSecrets` reference a `your-registry-secret` secret that must exist in the target namespace (optional — remove `imagePullSecrets` if pulling from a public registry).

## CPU / Memory

The API reads CPU and memory usage from the Kubernetes metrics API (`metrics.k8s.io/v1beta1`). This requires `metrics-server` to be installed and the ServiceAccount to have RBAC for `pods` resources under `metrics.k8s.io`. If metrics are unavailable, usage fields return `null` but requests/limits (from pod spec) are still shown.
