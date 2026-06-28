import { execSync } from 'node:child_process';
import net from 'node:net';

export interface AgentDeckProbe {
  backendUp: boolean;
  mcpUp: boolean;
  backendVersion?: string;
  backendUrl: string;
  mcpUrl: string;
}

async function fetchJson(url: string, timeoutMs = 2000): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function isTcpPortOpen(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (open: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(1500);
    socket.on('connect', () => done(true));
    socket.on('timeout', () => done(false));
    socket.on('error', () => done(false));
  });
}

export async function probeAgentDeck(
  host: string,
  backendPort: number,
  mcpPort: number,
): Promise<AgentDeckProbe> {
  const backendUrl = `http://${host}:${backendPort}`;
  const mcpUrl = `http://${host}:${mcpPort}`;

  const [backendHealth, mcpHealth] = await Promise.all([
    fetchJson(`${backendUrl}/health`),
    fetchJson(`${mcpUrl}/health`),
  ]);

  const backendUp =
    backendHealth?.status === 'ok' &&
    (backendHealth.service === 'agent-deck-backend' || typeof backendHealth.version === 'string');
  const mcpUp = mcpHealth?.service === 'agent-deck-mcp-server';

  return {
    backendUp,
    mcpUp,
    backendVersion: typeof backendHealth?.version === 'string' ? backendHealth.version : undefined,
    backendUrl,
    mcpUrl,
  };
}

export function listListeningPids(port: number): number[] {
  if (process.platform === 'win32') {
    return [];
  }

  try {
    const output = execSync(`lsof -ti :${port} -sTCP:LISTEN`, { encoding: 'utf8' }).trim();
    if (!output) {
      return [];
    }
    return output
      .split('\n')
      .map((value) => Number.parseInt(value, 10))
      .filter((pid) => Number.isFinite(pid) && pid > 0);
  } catch {
    return [];
  }
}

export function formatPortConflict(
  port: number,
  label: string,
  host: string,
  isAgentDeck: boolean,
): string {
  const pids = listListeningPids(port);
  const pidHint =
    pids.length > 0
      ? ` Listening PID(s): ${pids.join(', ')}.`
      : process.platform === 'win32'
        ? ''
        : ` Check: lsof -i :${port}`;

  if (isAgentDeck) {
    return `Port ${port} (${label}) is already used by a running Agent Deck instance on ${host}.${pidHint}`;
  }

  return (
    `Port ${port} (${label}) is in use by another program on ${host}.${pidHint}\n` +
    `  • Free the port, or start on different ports: agent-deck start --port <api> --mcp-port <mcp>\n` +
    `  • If you change ports, re-run: agent-deck setup --client <cursor|claude>`
  );
}
