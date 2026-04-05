#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${PROD_KUBE_CONTEXT:-}" ]]; then
  echo "PROD_KUBE_CONTEXT is not set. Aborting."
  exit 1
fi

current_context=$(kubectl config current-context)
if [[ "$current_context" != "$PROD_KUBE_CONTEXT" ]]; then
  echo "Current kube context is '$current_context' but expected '$PROD_KUBE_CONTEXT'. Aborting."
  exit 1
fi

echo "==> Building and pushing image (multi-arch)"
yarn push

echo "==> Applying Kubernetes manifests (prod)"
kubectl apply -f k8s/deployment-prod.yaml

echo "==> Rolling out deployment (prod)"
kubectl rollout restart deployment/kubescout -n your-namespace

echo "✅ Deploy (prod) complete"