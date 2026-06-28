import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { resolveBackendEntry, resolveUiDist } from './paths';
import { maybeAutoUpgradeOnStart, notifyIfUpdateAvailable } from './upgrade';
import { getAgentDeckVersion } from './version';

export interface StartOptions {
  backendPort?: number;
  mcpPort?: number;
  openBrowser?: boolean;
  skipUi?: boolean;
}

const children: ChildProcess[] = [];
let shuttingDown = false;

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function waitForHealth(url: string, attempts = 60): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function spawnNodeService(
  label: string,
  entry: string,
  env: Record<string, string>,
): ChildProcess {
  const child = spawn(process.execPath, [entry], {
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }
    const detail = signal ? `signal ${signal}` : `code ${code ?? 1}`;
    console.error(`[agent-deck] ${label} exited (${detail})`);
    void shutdown(code ?? 1);
  });

  children.push(child);
  return child;
}

async function shutdown(exitCode = 0): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 300));
  process.exit(exitCode);
}

export async function runStart(options: StartOptions = {}): Promise<number> {
  await maybeAutoUpgradeOnStart();
  await notifyIfUpdateAvailable();

  const backendPort = options.backendPort ?? parsePort(process.env.AGENT_DECK_PORT, 8000);
  const mcpPort = options.mcpPort ?? parsePort(process.env.AGENT_DECK_MCP_PORT, 3001);
  const host = process.env.AGENT_DECK_HOST ?? '127.0.0.1';
  const backendUrl = `http://${host}:${backendPort}`;
  const uiDist = options.skipUi ? undefined : resolveUiDist();

  if (!options.skipUi && !uiDist) {
    console.warn(
      '[agent-deck] Dashboard UI bundle not found (static-ui). API and MCP will still start.',
    );
    console.warn('[agent-deck] Set AGENT_DECK_UI_DIST or run from a published npm package build.');
  }

  const backendEntry = resolveBackendEntry('index');
  const mcpEntry = resolveBackendEntry('mcp-index');

  console.log('[agent-deck] Starting backend ...');
  spawnNodeService('backend', backendEntry, {
    PORT: String(backendPort),
    HOST: host,
    ...(uiDist ? { AGENT_DECK_UI_DIST: uiDist } : {}),
  });

  const healthy = await waitForHealth(`${backendUrl}/health`);
  if (!healthy) {
    console.error('[agent-deck] Backend failed health check');
    await shutdown(1);
    return 1;
  }

  console.log('[agent-deck] Starting MCP server ...');
  spawnNodeService('mcp', mcpEntry, {
    AGENT_DECK_MCP_PORT: String(mcpPort),
    AGENT_DECK_BACKEND_URL: backendUrl,
  });

  const dashboardLine = uiDist ? backendUrl : '(UI bundle missing — use npm run dev:all for dev UI)';
  console.log('');
  console.log('Agent Deck is running');
  console.log(`  Dashboard  ${dashboardLine}`);
  console.log(`  MCP        http://${host}:${mcpPort}/mcp`);
  console.log(`  API health ${backendUrl}/health`);
  console.log('');
  console.log('Claude Code:');
  console.log(`  claude mcp add --scope user --transport http agent-deck http://${host}:${mcpPort}/mcp`);
  console.log('');

  if (options.openBrowser && uiDist) {
    const open = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    spawn(open, [backendUrl], { stdio: 'ignore', shell: process.platform === 'win32' });
  }

  process.on('SIGINT', () => void shutdown(0));
  process.on('SIGTERM', () => void shutdown(0));

  await new Promise<void>(() => {
    // keep alive until signal
  });
  return 0;
}

export async function runDoctor(): Promise<number> {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  let ok = true;

  console.log(`Node.js ${process.version}`);
  if (nodeMajor < 20) {
    console.error('FAIL: Node.js 20+ required');
    ok = false;
  } else {
    console.log('OK: Node.js version');
  }

  try {
    resolveBackendEntry('index');
    console.log('OK: backend build present');
  } catch (error) {
    console.error(`FAIL: ${error instanceof Error ? error.message : error}`);
    ok = false;
  }

  const uiDist = resolveUiDist();
  if (uiDist) {
    console.log(`OK: dashboard UI at ${uiDist}`);
  } else {
    console.warn('WARN: dashboard UI bundle missing (optional for API/MCP)');
  }

  console.log(`Package version ${getAgentDeckVersion()}`);

  return ok ? 0 : 1;
}
