import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { readJsonFile, writeJsonFile } from './mcp-config';
import { getAgentDeckVersion } from './version';
import { sanitizeJsonText } from './strip-ansi';

export const STATUSLINE_SCRIPT_NAME = 'statusline.sh';
export const STATUSLINE_REFRESH_INTERVAL_SEC = 3;

export type StatuslineClient = 'cursor' | 'claude';

export type StatuslineInstallResult = {
  installed: boolean;
  configPath: string;
  scriptPath: string;
  action: 'created' | 'updated' | 'unchanged';
  message: string;
};

function resolveStatuslineScriptPath(): string {
  return path.join(os.homedir(), '.agent-deck', 'bin', STATUSLINE_SCRIPT_NAME);
}

function buildStatuslineScript(cliVersion: string): string {
  return `#!/usr/bin/env bash
# Agent Deck status line — installed by agent-deck setup
set -euo pipefail

export NO_COLOR=1
export FORCE_COLOR=0
export NPM_CONFIG_COLOR=false

if command -v agent-deck >/dev/null 2>&1; then
  exec agent-deck statusline "$@"
fi

NODE_BIN="\${NODE_BIN:-}"
if [ -z "$NODE_BIN" ] && command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
fi
if [ -z "$NODE_BIN" ] && [ -x /opt/homebrew/bin/node ]; then
  NODE_BIN=/opt/homebrew/bin/node
fi
if [ -z "$NODE_BIN" ] && [ -x /usr/local/bin/node ]; then
  NODE_BIN=/usr/local/bin/node
fi
if [ -z "$NODE_BIN" ]; then
  NODE_BIN=node
fi

GLOBAL_CLI="$(npm root -g 2>/dev/null)/@agent-deck/cli/dist/bin.js"
if [ -f "$GLOBAL_CLI" ]; then
  exec "$NODE_BIN" "$GLOBAL_CLI" statusline "$@"
fi

exec npx -y @agent-deck/cli@${cliVersion} statusline "$@" 2>/dev/null
`;
}

export function installStatuslineScript(): { scriptPath: string; action: 'created' | 'updated' | 'unchanged' } {
  const scriptPath = resolveStatuslineScriptPath();
  const next = buildStatuslineScript(getAgentDeckVersion());
  const existing = fs.existsSync(scriptPath) ? fs.readFileSync(scriptPath, 'utf8') : '';

  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  fs.writeFileSync(scriptPath, next, { encoding: 'utf8', mode: 0o755 });

  return {
    scriptPath,
    action: existing === next ? 'unchanged' : existing ? 'updated' : 'created',
  };
}

function resolveStatuslineConfigPath(client: StatuslineClient): string {
  const home = os.homedir();
  if (client === 'cursor') {
    return path.join(home, '.cursor', 'cli-config.json');
  }
  return path.join(home, '.claude', 'settings.json');
}

function buildStatuslineConfig(scriptPath: string, client: StatuslineClient): Record<string, unknown> {
  const base = {
    type: 'command',
    command: scriptPath,
    padding: 2,
  };

  if (client === 'cursor') {
    return {
      ...base,
      timeoutMs: 1500,
    };
  }

  return {
    ...base,
    refreshInterval: STATUSLINE_REFRESH_INTERVAL_SEC,
  };
}

function mergeStatuslineConfig(
  existing: Record<string, unknown>,
  scriptPath: string,
  client: StatuslineClient,
): { config: Record<string, unknown>; changed: boolean } {
  const nextStatusLine = buildStatuslineConfig(scriptPath, client);
  const current = existing.statusLine;
  const unchanged =
    current &&
    typeof current === 'object' &&
    !Array.isArray(current) &&
    (current as Record<string, unknown>).command === nextStatusLine.command &&
    (current as Record<string, unknown>).type === nextStatusLine.type;

  if (unchanged) {
    return { config: existing, changed: false };
  }

  return {
    config: {
      ...existing,
      statusLine: nextStatusLine,
    },
    changed: true,
  };
}

export function installStatusline(client: StatuslineClient): StatuslineInstallResult {
  const { scriptPath, action: scriptAction } = installStatuslineScript();
  const configPath = resolveStatuslineConfigPath(client);
  const existing = readJsonFile(configPath);
  const { config, changed } = mergeStatuslineConfig(existing, scriptPath, client);

  if (changed) {
    writeJsonFile(configPath, config);
  }

  const configAction = changed ? (Object.keys(existing).length ? 'updated' : 'created') : 'unchanged';

  const finalAction: StatuslineInstallResult['action'] =
    scriptAction === 'created' || configAction === 'created'
      ? 'created'
      : scriptAction === 'unchanged' && configAction === 'unchanged'
        ? 'unchanged'
        : 'updated';

  const hostLabel = client === 'cursor' ? 'Cursor CLI' : 'Claude Code';

  return {
    installed: true,
    configPath,
    scriptPath,
    action: finalAction,
    message:
      finalAction === 'unchanged'
        ? `Status line already configured for ${hostLabel} → ${configPath}`
        : `Installed deck status line for ${hostLabel} → ${configPath} (command: ${scriptPath})`,
  };
}
