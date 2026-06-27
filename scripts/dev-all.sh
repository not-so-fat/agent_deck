#!/usr/bin/env bash
set -euo pipefail

# Ensure Node 20 via nvm if available; otherwise fall back to brew node@20 on macOS
if command -v nvm >/dev/null 2>&1; then
  nvm install 20 >/dev/null
  nvm use 20 >/dev/null
elif [[ "${OSTYPE:-}" == darwin* ]] && [[ -x "/opt/homebrew/opt/node@20/bin/node" ]]; then
  export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"

echo "[dev-all] Starting backend (8000) ..."
(
  cd "$ROOT_DIR/packages/backend"
  npm run dev 2>&1 | tee "$LOG_DIR/backend.log"
) &

sleep 1

echo "[dev-all] Starting frontend (3000) ..."
(
  cd "$ROOT_DIR/apps/agent-deck"
  npm run dev -- --port 3000 --strictPort 2>&1 | tee "$LOG_DIR/frontend.log"
) &

sleep 1

echo "[dev-all] Building MCP App bundle ..."
(
  cd "$ROOT_DIR/packages/mcp-app"
  npm run build 2>&1 | tee "$LOG_DIR/mcp_app_build.log"
)

echo "[dev-all] Starting MCP server (3001) ..."
if lsof -i :3001 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "[dev-all] Stopping existing MCP server on port 3001 ..."
  lsof -ti :3001 | xargs kill 2>/dev/null || true
  sleep 1
fi
(
  cd "$ROOT_DIR/packages/backend"
  tsx src/mcp-index.ts 2>&1 | tee "$LOG_DIR/mcp_ts_direct.log"
) &

echo "[dev-all] Verifying MCP connection (Cursor-style) ..."
sleep 2
node "$ROOT_DIR/scripts/test-mcp-cursor-connect.mjs" || echo "[dev-all] WARNING: MCP connect test failed — check $LOG_DIR/mcp_ts_direct.log"

echo "[dev-all] All services started. Logs in $LOG_DIR"
wait

