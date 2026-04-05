# Auto-Reload Development Mode

## Overview

The dev environment has **automatic reload** that detects code changes and restarts the server automatically.

## How It Works

### For Kotlin files (.kt)
- **What:** Recompiles and restarts the server
- **How:** Polling-based file watching (every 2 seconds)
- **Time:** ~5-10 seconds from change to reload

### For frontend files (.js, .css, .html)
- **What:** No rebuild needed!
- **How:** Served directly from the mounted volume
- **Time:** Instant (just refresh the browser)

## Starting the Dev Environment

```bash
# Start with auto-reload
yarn up-dev

# Or in the background
yarn up-dev-background

# Show logs
yarn logs-dev
```

## What You'll See

```
[dev] Auto-reload enabled! Watching for .kt file changes...
[dev] Note: JavaScript/CSS changes are served directly (no rebuild needed)
[dev] Checking for changes every 2s
[dev] App started (PID: 123)
```

### When you change Kotlin code:

```
[dev] Kotlin source changes detected! Rebuilding...
[dev] Building...
[dev] Build complete.
[dev] Stopping old app instance (PID: 123)
[dev] Starting app: target/app.jar
[dev] App started (PID: 456)
[dev] Reload complete!
```

### When you change JS/CSS:

1. Save the file
2. Refresh browser (Cmd+R)
3. Done! (no rebuild)

## Cache Busting

All CSS/JS files use MD5-based cache busting:

```html
<!-- Generated automatically on reload -->
<link rel="stylesheet" href="/dashboard/css/shared/base.css?v=a7f337b4" />
<script src="/dashboard/js/vue-app.js?v=b2e8c901"></script>
```

**The hash updates automatically** when:
- You change a .kt file and the server rebuilds
- The MD5 is recalculated from the file contents

## Workflow

### Typical Development

```bash
# Terminal 1: Start the dev environment
yarn up-dev

# Terminal 2: Code
# Edit files in your IDE
# Changes are automatically detected!

# Terminal 3: Show logs (optional)
yarn logs-dev
```

### Frontend-only changes

```
1. Edit JS/CSS/HTML files
2. Save (Cmd+S)
3. Refresh browser (Cmd+R)
4. See changes immediately!
```

### Backend changes (Kotlin)

```
1. Edit .kt files
2. Save (Cmd+S)
3. Wait ~5-10s (rebuild happens automatically)
4. Refresh browser (Cmd+R)
5. See changes!
```

## Technical Details

### File Watching

**Problem:** macOS + Docker volumes → inotify events do not work

**Solution:** Polling-based detection
```bash
# Checks checksum of all .kt files every 2 seconds
find /app/src -name "*.kt" -printf "%T@ %p\n" | md5sum
```

### Why Only Kotlin?

Frontend files (JS/CSS/HTML) live in `src/main/resources/` which is:
- Mounted as a Docker volume
- Served directly by Ktor
- No rebuild needed!

### Crash Recovery

If the app crashes:
```
[dev] App crashed! Restarting...
[dev] Starting app: target/app.jar
[dev] App started (PID: 789)
```

## Troubleshooting

### No changes detected

```bash
# Check that the container is running
docker ps | grep kss-dev

# Check logs
yarn logs-dev

# Manual restart (fallback)
yarn reload-dev
```

### Slow rebuild

```bash
# Build incrementally (saves ~50% time)
# Already enabled with:
# -Dkotlin.compiler.execution.strategy=in-process
```

### Browser cache problems

```bash
# Hard refresh
Cmd+Shift+R (Chrome/Firefox on Mac)

# Or open DevTools and disable cache
# Chrome: DevTools -> Network -> Disable cache
```

## Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Initial build | ~30-60s | First time only |
| Incremental rebuild | ~5-10s | On .kt changes |
| JS/CSS reload | 0s | No rebuild! |
| File check interval | 2s | Adjustable |

## Configuration

### Change check interval

Edit `src/main/resources/dev/watch-and-run.sh`:
```bash
CHECK_INTERVAL=2  # Change to 1 for faster, 5 for less CPU
```

Rebuild the dev container:
```bash
yarn up-dev
```

## Comparison: Before vs After

### Before (Manual)

```bash
# 1. Change code
vim src/main/kotlin/MyFile.kt

# 2. Manual restart
yarn reload-dev

# 3. Wait ~30s

# 4. Refresh browser
```

### After (Auto)

```bash
# 1. Change code
vim src/main/kotlin/MyFile.kt

# 2. Wait ~5s (auto rebuild)

# 3. Refresh browser
```

**Time saved:** ~25 seconds per change

---

**Updated:** 2026-03-06
**Author:** Dev Experience Team
**Status:** Production Ready
