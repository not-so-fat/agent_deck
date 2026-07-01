#!/usr/bin/env bash
# Release integration smoke — simulates fresh npm install + setup user path.
# Catches "command shipped, installer/docs not" regressions (see 1.2.3 statusline).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.temporal/logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/release-smoke.log"
: >"$LOG"

SMOKE_HOME=""
PACK_DIR=""
cleanup() {
  [[ -n "$SMOKE_HOME" ]] && rm -rf "$SMOKE_HOME"
  [[ -n "$PACK_DIR" ]] && rm -rf "$PACK_DIR"
}
trap cleanup EXIT

fail() {
  echo "[release-smoke] FAIL: $*" | tee -a "$LOG" >&2
  exit 1
}

pass() {
  echo "[release-smoke] $*" | tee -a "$LOG"
}

CLI_DIST="$ROOT_DIR/packages/cli/dist"
if [[ ! -f "$CLI_DIST/bin.js" ]]; then
  fail "CLI not built — run npm run build first ($CLI_DIST/bin.js missing)"
fi

# --- 1. Tarball must include installer modules ---
for required in bin.js statusline.js statusline-setup.js setup.js; do
  if [[ ! -f "$CLI_DIST/$required" ]]; then
    fail "dist/$required missing from CLI build (would not ship on npm)"
  fi
done
pass "CLI dist contains statusline + setup modules"

# --- 2. npm pack fidelity ---
PACK_DIR="$(mktemp -d)"
SMOKE_HOME="$(mktemp -d)"
export HOME="$SMOKE_HOME"
export NO_COLOR=1

cd "$ROOT_DIR/packages/cli"
TGZ_NAME="$(npm pack --pack-destination "$PACK_DIR" 2>>"$LOG" | tail -1)"
TGZ_PATH="$PACK_DIR/$TGZ_NAME"
[[ -f "$TGZ_PATH" ]] || fail "npm pack failed — $TGZ_PATH"
tar -xzf "$TGZ_PATH" -C "$PACK_DIR"
PKG_ROOT="$PACK_DIR/package"
[[ -f "$PKG_ROOT/dist/statusline-setup.js" ]] || fail "packed tarball missing dist/statusline-setup.js"
pass "npm pack includes statusline-setup.js"

# --- 3. setup --client claude in clean HOME (built dist = tarball payload) ---
SETUP_OUT="$LOG_DIR/release-smoke-setup.log"
if ! node "$CLI_DIST/bin.js" setup --client claude >"$SETUP_OUT" 2>&1; then
  # claude mcp add may fail in CI — status line install must still run
  if ! grep -qE 'Status line|status line' "$SETUP_OUT"; then
    cat "$SETUP_OUT" >>"$LOG"
    fail "setup --client claude did not install status line (see $SETUP_OUT)"
  fi
fi
pass "setup --client claude ran (see $SETUP_OUT)"

SCRIPT_PATH="$SMOKE_HOME/.agent-deck/bin/statusline.sh"
SETTINGS_PATH="$SMOKE_HOME/.claude/settings.json"

[[ -x "$SCRIPT_PATH" ]] || fail "statusline.sh not created or not executable: $SCRIPT_PATH"
pass "statusline.sh exists: $SCRIPT_PATH"

[[ -f "$SETTINGS_PATH" ]] || fail "Claude settings not written: $SETTINGS_PATH"
if ! grep -q '"statusLine"' "$SETTINGS_PATH"; then
  fail "settings.json missing statusLine block"
fi
if ! grep -q "$SCRIPT_PATH" "$SETTINGS_PATH"; then
  fail "settings.json statusLine.command does not point at $SCRIPT_PATH"
fi
pass "settings.json wires statusLine → script"

# --- 4. Wrapper script contract ---
SCRIPT_BODY="$(<"$SCRIPT_PATH")"
if ! grep -q 'NO_COLOR=1' <<<"$SCRIPT_BODY"; then
  fail "statusline.sh missing NO_COLOR=1 (npm warnings can break Claude footer)"
fi
if ! grep -q '2>/dev/null' <<<"$SCRIPT_BODY"; then
  fail "statusline.sh npx fallback must redirect stderr (npm warn on stdout)"
fi
pass "wrapper script has NO_COLOR + stderr redirect"

# --- 5. Stdout contract (single line, no npm noise) ---
STATUS_OUT="$LOG_DIR/release-smoke-statusline.out"
echo '{"cwd":"/tmp/smoke-workspace"}' | "$SCRIPT_PATH" >"$STATUS_OUT" 2>>"$LOG" || true
LINE_COUNT="$(grep -c . "$STATUS_OUT" || true)"
[[ "$LINE_COUNT" -eq 1 ]] || fail "statusline must print exactly one line on stdout (got $LINE_COUNT)"
if grep -qi 'npm warn' "$STATUS_OUT"; then
  fail "npm warning leaked to stdout — host apps may show blank status"
fi
if ! grep -q '^◆' "$STATUS_OUT"; then
  fail "statusline output must start with ◆ (got: $(cat "$STATUS_OUT"))"
fi
pass "statusline stdout (closed stdin): $(cat "$STATUS_OUT")"

# --- 5b. Claude host POC: stdin left open (must not hang) ---
OPEN_OUT="$LOG_DIR/release-smoke-statusline-open-stdin.out"
OPEN_ERR="$LOG_DIR/release-smoke-statusline-open-stdin.err"
if ! node -e "
const { spawn } = require('child_process');
const fs = require('fs');
const script = process.argv[1];
const outPath = process.argv[2];
const errPath = process.argv[3];
const budgetMs = 800;
const hardMs = 2000;
const start = Date.now();
const child = spawn(script, [], {
  env: {
    ...process.env,
    NO_COLOR: '1',
    AGENT_DECK_PORT: '59999',
    AGENT_DECK_STATUSLINE_TIMEOUT_MS: '50',
  },
  stdio: ['pipe', 'pipe', 'pipe'],
});
let stdout = '';
let stderr = '';
child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
child.stdin.write('{\"cwd\":\"/tmp/smoke-open-stdin\"}');
const timer = setTimeout(() => {
  child.kill('SIGKILL');
  process.exit(2);
}, hardMs);
child.on('close', (code) => {
  clearTimeout(timer);
  fs.writeFileSync(outPath, stdout);
  if (stderr) fs.writeFileSync(errPath, stderr);
  const ms = Date.now() - start;
  if (code !== 0 || ms > budgetMs) process.exit(1);
  process.exit(0);
});
" "$SCRIPT_PATH" "$OPEN_OUT" "$OPEN_ERR" 2>>"$LOG"; then
  fail "statusline hung with open stdin (Claude POC) — see $OPEN_ERR"
fi
OPEN_LINES="$(grep -c . "$OPEN_OUT" || true)"
[[ "$OPEN_LINES" -eq 1 ]] || fail "open-stdin POC must print one line (got $OPEN_LINES)"
pass "statusline stdout (open stdin POC): $(cat "$OPEN_OUT")"

# --- 6. CHANGELOG honesty — fail if current version still has Pending publish for statusline ---
CHANGELOG="$ROOT_DIR/CHANGELOG.md"
VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
if [[ -f "$CHANGELOG" ]]; then
  awk -v ver="$VERSION" '
    /^## / {
      in_section = ($0 ~ "^## " ver "([ —-]|$)")
      if (!in_section) pending = 0
    }
    in_section && /^### Pending publish/ { pending = 1 }
    in_section && pending && /setup.*status/i { found = 1 }
    END { if (found) exit 1; exit 0 }
  ' "$CHANGELOG" || fail "CHANGELOG $VERSION still lists setup/statusline under Pending publish — ship or move to pending"
fi
pass "CHANGELOG pending section check passed"

pass "PASS — release integration smoke (log: $LOG)"
