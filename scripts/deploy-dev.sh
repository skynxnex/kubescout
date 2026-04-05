#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DEV_KUBE_CONTEXT:-}" ]]; then
  echo "DEV_KUBE_CONTEXT is not set. Aborting."
  exit 1
fi

current_context=$(kubectl config current-context)
if [[ "$current_context" != "$DEV_KUBE_CONTEXT" ]]; then
  echo "Current kube context is '$current_context' but expected '$DEV_KUBE_CONTEXT'. Aborting."
  exit 1
fi

echo "==> Building and pushing image (multi-arch)"
yarn push

echo "==> Applying Kubernetes manifests (dev)"
kubectl apply -f k8s/deployment-dev.yaml

echo "==> Rolling out deployment (dev)"
kubectl rollout restart deployment/kss -n your-namespace

echo "✅ Deploy (dev) complete"