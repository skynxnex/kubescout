# Development Environment Setup

## Fixed: "Too many open files" Error

The development environment was experiencing "Too many open files" errors on macOS Docker Desktop due to file descriptor limits. This has been resolved by using `ulimit -n 10240` instead of the default 65536.

## Quick Start

```bash
# Start the dev environment
yarn up-dev

# Access the app
open http://localhost:8081
```

## How It Works

### Problem
Docker Desktop for Mac (VirtioFS) has file descriptor limits that cause "Too many open files" errors when:
- Using very high ulimit values (e.g., 65536)
- Mounting directories with many files (like `~/.kube` or `~/.aws`)
- Using file watchers like `inotifywait`

### Solution
We now use `ulimit -n 10240` which is high enough for the app but low enough to avoid VirtioFS issues:
- **Kubeconfig** (`~/.kube/config`) - mounted directly from host (read-only)
- **AWS config** (`~/.aws/`) - mounted directly from host (live updates)
- **Source code** (`src/`) - baked into image at build time
- **build.gradle.kts** - baked into image at build time

Docker volumes are used for caches:
- `build/` - build artifacts
- `gradle-cache` - Gradle dependencies cache

## Making Changes

### Code Changes (Kotlin/JavaScript/CSS/HTML)
Source code is mounted from your Mac, so changes are reflected immediately in the container.

**To apply code changes:**
```bash
yarn reload-dev
# or manually:
docker compose --profile dev restart kss-dev
```

This will:
1. Stop the app
2. Rebuild the JAR with your changes (Maven incremental compilation)
3. Start the app (~10 seconds total)

**Note:** File watching (auto-reload) is disabled on macOS because inotify events don't propagate through Docker volumes on macOS.

### Kubeconfig/AWS Config Changes
When your kubeconfig or AWS credentials change (e.g., after `aws sso login`):
- **No restart needed!** Just reload the browser page.
- Credentials are mounted from host and updated live.

## Trade-offs

**Pros:**
✅ No more "Too many open files" errors
✅ AWS credentials update automatically (no rebuild needed)
✅ Faster workflow when credentials expire
✅ Simpler setup - no prepare-dev script needed

**Cons:**
❌ No hot-reload for code - must rebuild for code changes
❌ Initial build takes time (Maven downloads dependencies)

## Troubleshooting

### Still seeing "Too many open files"?
- Make sure you're using the latest code
- Run `docker compose --profile dev down -v` to clean volumes
- Check `ulimit -n` in the container (should be 10240)

### App can't connect to Kubernetes?
- Verify your kubeconfig works locally: `kubectl get pods`
- Check if your AWS SSO session is valid: `aws sso login`
- Reload the browser page (no rebuild needed)
