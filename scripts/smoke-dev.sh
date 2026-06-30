#!/usr/bin/env bash
set -euo pipefail

# Quick smoke test: backend starts, health + key APIs respond, no websocket crash.
# Run from repo root after backend-affecting changes.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.temporal/logs"
mkdir -p "$LOG_DIR"
SMOKE_LOG="$LOG_DIR/smoke-dev.log"
SMOKE_DB="$LOG_DIR/smoke-agent_deck.db"
BACKEND_PORT="${SMOKE_BACKEND_PORT:-8010}"
BACKEND_PID=""

export AGENT_DECK_DB_PATH="$SMOKE_DB"

cleanup() {
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "[smoke-dev] Node $(node -v)"
echo "[smoke-dev] Database: $SMOKE_DB"
echo "[smoke-dev] Starting backend on port $BACKEND_PORT ..."
(
  cd "$ROOT_DIR/packages/backend"
  PORT="$BACKEND_PORT" npm run dev
) >"$SMOKE_LOG" 2>&1 &
BACKEND_PID=$!

for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:$BACKEND_PORT/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

echo "[smoke-dev] Checking /health ..."
curl -sf "http://127.0.0.1:$BACKEND_PORT/health" | tee -a "$SMOKE_LOG"
echo ""

echo "[smoke-dev] Checking agent credentials require deck context ..."
CRED_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$BACKEND_PORT/api/credentials")
if [[ "$CRED_STATUS" != "400" ]]; then
  echo "[smoke-dev] FAIL: expected 400 for /api/credentials without workspace context, got $CRED_STATUS" >&2
  exit 1
fi
echo "[smoke-dev] agent credentials correctly require workspace/deck context (400)"

echo "[smoke-dev] Checking dashboard vault requires client header ..."
VAULT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$BACKEND_PORT/api/credentials/vault")
if [[ "$VAULT_STATUS" != "403" ]]; then
  echo "[smoke-dev] FAIL: expected 403 for /api/credentials/vault without dashboard header, got $VAULT_STATUS" >&2
  exit 1
fi
echo "[smoke-dev] vault correctly blocked for agent clients (403)"

echo "[smoke-dev] Checking /api/decks ..."
curl -sf "http://127.0.0.1:$BACKEND_PORT/api/decks" | head -c 200 | tee -a "$SMOKE_LOG"
echo "..."

echo "[smoke-dev] Checking WebSocket /api/ws/events ..."
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:$BACKEND_PORT/api/ws/events');
ws.on('open', () => { ws.close(); process.exit(0); });
ws.on('error', (err) => { console.error(err.message); process.exit(1); });
setTimeout(() => { console.error('WebSocket timeout'); process.exit(1); }, 5000);
" | tee -a "$SMOKE_LOG"
echo ""

if grep -q "Cannot read properties of undefined (reading 'send')" "$SMOKE_LOG"; then
  echo "[smoke-dev] FAIL: WebSocket handler error in log" >&2
  exit 1
fi

if grep -q "Cannot read properties of undefined (reading 'on')" "$SMOKE_LOG"; then
  echo "[smoke-dev] FAIL: WebSocket handler error in log" >&2
  exit 1
fi

echo "[smoke-dev] PASS — backend healthy (log: $SMOKE_LOG)"
