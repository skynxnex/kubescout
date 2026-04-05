#!/usr/bin/env bash
set -euo pipefail

# Prepare files for dev Docker build
# This copies kubeconfig to avoid "Too many open files" errors with volume mounts on macOS

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_CONTEXT="$PROJECT_ROOT/.docker-build"

echo "[prepare-dev-build] Creating build context at $BUILD_CONTEXT"
mkdir -p "$BUILD_CONTEXT/.kube"
mkdir -p "$BUILD_CONTEXT/.aws"

# Copy kubeconfig if it exists
if [ -f "$HOME/.kube/config" ]; then
    echo "[prepare-dev-build] Copying kubeconfig..."
    cp "$HOME/.kube/config" "$BUILD_CONTEXT/.kube/config"
else
    echo "[prepare-dev-build] Warning: $HOME/.kube/config not found"
    touch "$BUILD_CONTEXT/.kube/config"
fi

# Copy AWS config if it exists (for EKS auth)
if [ -d "$HOME/.aws" ]; then
    echo "[prepare-dev-build] Copying AWS config..."
    cp -r "$HOME/.aws/"* "$BUILD_CONTEXT/.aws/" 2>/dev/null || true
else
    echo "[prepare-dev-build] Warning: $HOME/.aws not found"
fi

echo "[prepare-dev-build] Build context ready"
