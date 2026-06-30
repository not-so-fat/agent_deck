import { spawn } from 'node:child_process';

import { installAgentHarness } from './agent-harness';
import {
  buildAgentDeckEntry,
  buildMcpUrl,
  mergeMcpServerConfig,
  readJsonFile,
  resolveConfigPath,
  writeJsonFile,
  type McpClient,
  type McpEndpoint,
  type SetupScope,
} from './mcp-config';
import { CLI_DEFAULT_MCP_PORT, parseCliMcpPort } from './defaults';

export interface SetupOptions {
  client: McpClient;
  scope?: SetupScope;
  host?: string;
  mcpPort?: number;
  start?: boolean;
}

function parseClient(value: string | undefined): McpClient | null {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();
  if (normalized === 'claude-code' || normalized === 'claude_code') {
    return 'claude';
  }

  if (normalized === 'cursor' || normalized === 'claude' || normalized === 'claude-desktop') {
    return normalized;
  }

  return null;
}

function parseSetupArgs(args: string[]): SetupOptions | { error: string } {
  let client: McpClient | null = null;
  let scope: SetupScope = 'global';
  let host = process.env.AGENT_DECK_HOST ?? '127.0.0.1';
  let mcpPort = parseCliMcpPort(process.env.AGENT_DECK_MCP_PORT);
  let start = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--client') {
      client = parseClient(args[++i]);
    } else if (arg === '--scope') {
      const value = args[++i];
      if (value === 'global' || value === 'project') {
        scope = value;
      } else {
        return { error: '--scope must be global or project' };
      }
    } else if (arg === '--host') {
      host = args[++i] ?? host;
    } else if (arg === '--mcp-port') {
      mcpPort = Number.parseInt(args[++i] ?? '', 10);
    } else if (arg === '--start') {
      start = true;
    } else if (arg === '--help' || arg === '-h') {
      return { error: 'help' };
    } else {
      return { error: `Unknown setup option: ${arg}` };
    }
  }

  if (!client) {
    return { error: '--client is required (cursor, claude, or claude-desktop)' };
  }

  if (client !== 'cursor' && client !== 'claude' && scope === 'project') {
    return { error: '--scope project is only supported for cursor and claude' };
  }

  if (!Number.isFinite(mcpPort)) {
    return { error: '--mcp-port must be a number' };
  }

  return { client, scope, host, mcpPort, start };
}

async function tryClaudeCliAdd(endpoint: McpEndpoint): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn(
      'claude',
      [
        'mcp',
        'add',
        '--scope',
        'user',
        '--transport',
        'http',
        'agent-deck',
        buildMcpUrl(endpoint),
      ],
      { stdio: ['ignore', 'pipe', 'pipe'], env: process.env },
    );

    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => resolve({ ok: false, error: error.message }));
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ ok: true });
        return;
      }
      resolve({ ok: false, error: stderr.trim() || `claude mcp add exited with code ${code}` });
    });
  });
}

export function printSetupUsage(): void {
  console.log(`Usage:
  agent-deck setup --client cursor|claude|claude-desktop [--scope global|project] [--mcp-port PORT] [--start]

Options:
  --client          MCP client to configure (required)
  --scope           global (default) or project — project only for cursor/claude
  --host            MCP host (default 127.0.0.1 or AGENT_DECK_HOST)
  --mcp-port        MCP port (default ${CLI_DEFAULT_MCP_PORT} or AGENT_DECK_MCP_PORT)
  --start           Start Agent Deck after writing config

Setup installs MCP config and agent harness rules (Cursor .cursor/rules or Claude CLAUDE.md).`);
}

function finishSetup(
  client: McpClient,
  scope: SetupScope,
  endpoint: McpEndpoint,
  shouldStart: boolean,
): number {
  const harness = installAgentHarness(client, scope);
  console.log(harness.message);
  if (!harness.installed && client === 'claude-desktop') {
    console.log('  See docs/AGENT_HARNESS.md if you also use Claude Code or Cursor.');
  }

  printNextSteps(endpoint, shouldStart, client);
  return shouldStart ? 2 : 0;
}

export async function runSetup(args: string[]): Promise<number> {
  const parsed = parseSetupArgs(args);
  if ('error' in parsed) {
    if (parsed.error === 'help') {
      printSetupUsage();
      return 0;
    }
    console.error(parsed.error);
    printSetupUsage();
    return 1;
  }

  const endpoint: McpEndpoint = {
    host: parsed.host ?? '127.0.0.1',
    mcpPort: parsed.mcpPort ?? CLI_DEFAULT_MCP_PORT,
  };
  const scope = parsed.scope ?? 'global';

  if (parsed.client === 'claude') {
    const added = await tryClaudeCliAdd(endpoint);
    if (added.ok) {
      console.log('Configured Claude Code via `claude mcp add` → ~/.claude.json');
      console.log('Verify: claude mcp list');
      return finishSetup(parsed.client, scope, endpoint, parsed.start === true);
    }
    console.warn(`Claude CLI failed (${added.error ?? 'unknown error'}) — writing ~/.claude.json instead`);
  }

  const configPath = resolveConfigPath(parsed.client, scope);
  const entry = buildAgentDeckEntry(parsed.client, endpoint);
  const merged = mergeMcpServerConfig(readJsonFile(configPath), entry);
  writeJsonFile(configPath, merged);

  console.log(`Wrote agent-deck MCP config → ${configPath}`);
  if (parsed.client === 'claude-desktop') {
    console.log('Claude Desktop uses a stdio bridge (supergateway) because JSON config is stdio-only.');
    console.log('Start Agent Deck before opening Claude Desktop.');
  }

  return finishSetup(parsed.client, scope, endpoint, parsed.start === true);
}

function printNextSteps(endpoint: McpEndpoint, shouldStart: boolean, client: McpClient): void {
  console.log('');
  console.log('Next steps:');
  if (shouldStart) {
    console.log('  1. Agent Deck will start now (same as `agent-deck start`)');
  } else {
    console.log('  1. npx @agent-deck/cli@latest start  (or `agent-deck stop` first if ports are busy)');
  }
  console.log(`  2. MCP endpoint → ${buildMcpUrl(endpoint)}`);
  console.log('  3. Restart Claude Code / Cursor so MCP + harness rules load');
  if (client === 'claude') {
    console.log('  4. Claude Code: `claude mcp list` — agent-deck should show Connected when step 1 is running');
  }
  console.log('');
  console.log('Optional: AGENT_DECK_AUTO_UPGRADE=1 agent-deck start  (check npm for updates on start)');
}

export function shouldStartAfterSetup(exitCode: number): boolean {
  return exitCode === 2;
}
