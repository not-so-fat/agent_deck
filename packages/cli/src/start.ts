import { spawn, type ChildProcess } from 'node:child_process';
import { resolveBackendEntry, resolveBackendRoot, resolveUiDist } from './paths';
import { assertSqliteNative, assertSupportedNodeVersion, getNodeMajor, verifySqliteNative } from './node-runtime';
import { formatPortConflict, isTcpPortOpen, listListeningPids, probeAgentDeck } from './ports';
import { clearRunState, writeRunState } from './runtime-state';
import { runStop } from './stop';
import { maybeAutoUpgradeOnStart, notifyIfUpdateAvailable } from './upgrade';
import { getAgentDeckVersion } from './version';
import { parseCliBackendPort, parseCliMcpPort } from './defaults';

export interface StartOptions {
  backendPort?: number;
  mcpPort?: number;
  openBrowser?: boolean;
  skipUi?: boolean;
  force?: boolean;
}

const children: ChildProcess[] = [];
let shuttingDown = false;

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
    if (label === 'backend') {
      void shutdown(code ?? 1);
      return;
    }
    console.warn(
      '[agent-deck] MCP stopped; dashboard API remains available. Run `agent-deck stop && agent-deck start` to recover MCP.',
    );
  });

  children.push(child);
  return child;
}

async function shutdown(exitCode = 0): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  clearRunState();

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 300));
  process.exit(exitCode);
}

function printRunningEndpoints(host: string, backendPort: number, mcpPort: number, backendUrl: string): void {
  console.log('');
  console.log('Agent Deck is running');
  console.log(`  Dashboard  ${backendUrl}`);
  console.log(`  MCP        http://${host}:${mcpPort}/mcp`);
  console.log(`  API health ${backendUrl}/health`);
  console.log('');
  console.log('Claude Code:');
  console.log(`  claude mcp add --scope user --transport http agent-deck http://${host}:${mcpPort}/mcp`);
  console.log('');
}

async function ensurePortsAvailable(
  host: string,
  backendPort: number,
  mcpPort: number,
  probe: Awaited<ReturnType<typeof probeAgentDeck>>,
): Promise<number | null> {
  const [backendBusy, mcpBusy] = await Promise.all([
    isTcpPortOpen(host, backendPort),
    isTcpPortOpen(host, mcpPort),
  ]);

  if (backendBusy && !probe.backendUp) {
    console.error(`[agent-deck] ${formatPortConflict(backendPort, 'API/dashboard', host, false)}`);
    return 1;
  }

  if (mcpBusy && !probe.mcpUp) {
    console.error(`[agent-deck] ${formatPortConflict(mcpPort, 'MCP', host, false)}`);
    return 1;
  }

  return null;
}

export async function runStart(options: StartOptions = {}): Promise<number> {
  const nodeError = assertSupportedNodeVersion();
  if (nodeError !== null) {
    return nodeError;
  }
  const sqliteError = assertSqliteNative();
  if (sqliteError !== null) {
    return sqliteError;
  }

  await maybeAutoUpgradeOnStart();
  await notifyIfUpdateAvailable();

  const backendPort = options.backendPort ?? parseCliBackendPort(process.env.AGENT_DECK_PORT);
  const mcpPort = options.mcpPort ?? parseCliMcpPort(process.env.AGENT_DECK_MCP_PORT);
  const host = process.env.AGENT_DECK_HOST ?? '127.0.0.1';
  const backendUrl = `http://${host}:${backendPort}`;
  const uiDist = options.skipUi ? undefined : resolveUiDist();

  const probe = await probeAgentDeck(host, backendPort, mcpPort);

  if (probe.backendUp && probe.mcpUp) {
    if (options.force) {
      console.log('[agent-deck] Restarting existing instance (--force) ...');
      await runStop();
      await new Promise((resolve) => setTimeout(resolve, 500));
    } else {
      printRunningEndpoints(host, backendPort, mcpPort, backendUrl);
      console.log('Already running. Use `agent-deck stop` or `agent-deck start --force` to restart.');
      return 0;
    }
  }

  const refreshedProbe = options.force ? await probeAgentDeck(host, backendPort, mcpPort) : probe;
  const portError = await ensurePortsAvailable(host, backendPort, mcpPort, refreshedProbe);
  if (portError !== null) {
    return portError;
  }

  if (!options.skipUi && !uiDist) {
    console.warn(
      '[agent-deck] Dashboard UI bundle not found (static-ui). API and MCP will still start.',
    );
    console.warn('[agent-deck] Set AGENT_DECK_UI_DIST or run from a published npm package build.');
  }

  const backendEntry = resolveBackendEntry('index');
  const mcpEntry = resolveBackendEntry('mcp-index');

  console.log('[agent-deck] Starting backend ...');
  const backendChild = spawnNodeService('backend', backendEntry, {
    PORT: String(backendPort),
    HOST: host,
    NODE_ENV: 'production',
    AGENT_DECK_DEV: '0',
    AGENT_DECK_MCP_PORT: String(mcpPort),
    ...(uiDist ? { AGENT_DECK_UI_DIST: uiDist } : {}),
  });

  const healthy = await waitForHealth(`${backendUrl}/health`);
  if (!healthy) {
    console.error('[agent-deck] Backend failed health check (port conflict or crash).');
    console.error(`[agent-deck] Run: agent-deck status`);
    await shutdown(1);
    return 1;
  }

  console.log('[agent-deck] Starting MCP server ...');
  let mcpPid = 0;

  if (refreshedProbe.mcpUp) {
    console.log('[agent-deck] MCP server already running — reusing existing instance');
    mcpPid = listListeningPids(mcpPort)[0] ?? 0;
  } else {
    const mcpChild = spawnNodeService('mcp', mcpEntry, {
      AGENT_DECK_MCP_PORT: String(mcpPort),
      AGENT_DECK_BACKEND_URL: backendUrl,
      NODE_ENV: 'production',
      AGENT_DECK_DEV: '0',
    });

    await new Promise((resolve) => setTimeout(resolve, 400));
    const mcpProbe = await probeAgentDeck(host, backendPort, mcpPort);
    if (!mcpProbe.mcpUp) {
      console.error('[agent-deck] MCP server failed to start (port conflict or crash).');
      console.error('[agent-deck] Dashboard API is still running. Run: agent-deck stop && agent-deck start');
    } else {
      mcpPid = mcpChild.pid ?? 0;
    }
  }
  writeRunState({
    host,
    backendPort,
    mcpPort,
    backendPid: backendChild.pid ?? 0,
    mcpPid,
    cliPid: process.pid,
    startedAt: new Date().toISOString(),
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
  const nodeMajor = getNodeMajor();
  let ok = true;

  console.log(`Node.js ${process.version}`);
  if (nodeMajor < 20) {
    console.error('FAIL: Node.js 20+ required (24 recommended — current OS default)');
    ok = false;
  } else if (!( [20, 22, 23, 24, 25, 26] as number[]).includes(nodeMajor)) {
    console.error('FAIL: Unsupported Node.js major for better-sqlite3 prebuilds');
    console.error('     Use Node 20+; Node 24 is the default target');
    ok = false;
  } else {
    console.log('OK: Node.js version');
  }

  const sqlite = verifySqliteNative();
  if (sqlite.ok) {
    console.log('OK: better-sqlite3 native module');
  } else {
    console.error('FAIL: better-sqlite3');
    console.error(sqlite.message);
    ok = false;
  }

  try {
    resolveBackendEntry('index');
    const backendRoot = resolveBackendRoot();
    console.log(`OK: backend at ${backendRoot}`);
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

  const host = process.env.AGENT_DECK_HOST ?? '127.0.0.1';
  const backendPort = parseCliBackendPort(process.env.AGENT_DECK_PORT);
  const mcpPort = parseCliMcpPort(process.env.AGENT_DECK_MCP_PORT);
  const probe = await probeAgentDeck(host, backendPort, mcpPort);
  if (probe.backendUp && probe.mcpUp) {
    console.log(`OK: Agent Deck reachable on :${backendPort} / :${mcpPort}`);
  } else {
    console.warn('WARN: Agent Deck is not running (agent-deck start)');
  }

  return ok ? 0 : 1;
}
