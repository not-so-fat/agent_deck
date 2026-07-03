#!/usr/bin/env bash
set -euo pipefail

# Uses whatever Node is on PATH (24 is the expected OS default).
# Dev data (DB, credentials metadata, secrets) → ~/.agent-deck/dev — not production ~/.agent-deck.

export AGENT_DECK_DEV=1
export AGENT_DECK_MCP_PORT=3001

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"

echo "[dev-all] Node $(node -v)"
echo "[dev-all] Data dir: AGENT_DECK_DEV=1 → ~/.agent-deck/dev"
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

echo "[dev-all] Starting MCP server (3001) ..."
(
  cd "$ROOT_DIR/packages/backend"
  npm run mcp 2>&1 | tee "$LOG_DIR/mcp_ts_direct.log"
) &

echo "[dev-all] All services started. Logs in $LOG_DIR"
echo "[dev-all] Deck status line: ensure ~/.cursor/cli-config.json statusLine → scripts/cursor-statusline.sh (uses API :8000, not MCP :3001)"
wait
