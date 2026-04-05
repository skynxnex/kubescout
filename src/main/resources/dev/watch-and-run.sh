#!/usr/bin/env bash
set -eu

echo "[dev] Starting watch-and-run with auto-reload"

WATCH_DIR="/app/src"
CHECK_INTERVAL=2  # Check every 2 seconds
APP_PID=""

# Cleanup on exit
cleanup() {
  echo "[dev] Shutting down..."
  if [ -n "$APP_PID" ] && kill -0 "$APP_PID" 2>/dev/null; then
    echo "[dev] Stopping app (PID: $APP_PID)"
    kill "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
  exit 0
}
trap cleanup EXIT SIGTERM SIGINT

# Build the application
build() {
  echo "[dev] Building..."
  ./gradlew bootJar --no-daemon -q
  echo "[dev] Build complete. JARs in build/libs:"
  ls -lh build/libs/*.jar 2>/dev/null || echo "No JARs found!"
  JAR="$(ls -1t build/libs/*.jar 2>/dev/null | head -n 1)"
  echo "[dev] Selected jar: $JAR"
  test -f "$JAR"
  echo "$JAR" > /tmp/current-jar
}

# Start the application in background
start_app() {
  if [ -n "$APP_PID" ] && kill -0 "$APP_PID" 2>/dev/null; then
    echo "[dev] Stopping old app instance (PID: $APP_PID)"
    kill "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi

  JAR="$(cat /tmp/current-jar)"
  echo "[dev] Starting app: $JAR"
  java -jar "$JAR" &
  APP_PID=$!
  echo "[dev] App started (PID: $APP_PID)"
}

# Get checksum of source files (Kotlin, JS, CSS)
get_checksum() {
  # Check .kt, .js, and .css files to trigger rebuild when frontend changes
  # This ensures MD5 cache-busting hashes are recalculated
  # Using -printf for Linux compatibility (not BSD stat)
  find "$WATCH_DIR" \( -name "*.kt" -o -name "*.js" -o -name "*.css" \) -type f -printf "%T@ %p\n" 2>/dev/null | sort | md5sum | cut -d' ' -f1
}

# Initial build and start
echo "[dev] Performing initial build..."
build
start_app

echo "[dev] 🔥 Auto-reload enabled! Watching for code changes..."
echo "[dev] 📝 Watching: .kt, .js, .css files"
echo "[dev] 🔄 Changes trigger rebuild to update cache-busting hashes"
echo "[dev] ⏱️  Checking for changes every ${CHECK_INTERVAL}s"

LAST_CHECKSUM="$(get_checksum)"

# Watch loop
while true; do
  sleep "$CHECK_INTERVAL"

  # Check if app is still running
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    echo "[dev] ⚠️  App crashed! Restarting..."
    start_app
    continue
  fi

  # Check for file changes
  CURRENT_CHECKSUM="$(get_checksum)"
  if [ "$CURRENT_CHECKSUM" != "$LAST_CHECKSUM" ]; then
    echo "[dev] 🔄 Kotlin source changes detected! Rebuilding..."
    build
    start_app
    LAST_CHECKSUM="$(get_checksum)"
    echo "[dev] ✅ Reload complete!"
  fi
done
