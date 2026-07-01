#!/usr/bin/env bash
# Cursor status line hook — dev:all uses API :8000 and data in ~/.agent-deck/dev
export NO_COLOR=1
export FORCE_COLOR=0
export NPM_CONFIG_COLOR=false
export AGENT_DECK_PORT="${AGENT_DECK_PORT:-8000}"
export AGENT_DECK_DEV="${AGENT_DECK_DEV:-1}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "${NODE_BIN:-}" ]; then
  if command -v node >/dev/null 2>&1; then
    NODE_BIN="$(command -v node)"
  elif [ -x /opt/homebrew/bin/node ]; then
    NODE_BIN=/opt/homebrew/bin/node
  elif [ -x /usr/local/bin/node ]; then
    NODE_BIN=/usr/local/bin/node
  else
    NODE_BIN=node
  fi
fi

exec "$NODE_BIN" "$REPO_ROOT/packages/cli/dist/bin.js" statusline
