import fs from 'node:fs';
import {
  BindingsFileSchema,
  DeckDisplay,
  formatDisplayLine,
  listBindingsFileCandidates,
  resolveStatusLineSessionId,
  resolveStatusLineWorkspace,
  StatusLinePayloadSchema,
} from '@agent-deck/shared';
import { parseCliBackendPort, CLI_DEFAULT_BACKEND_PORT } from './defaults';
import { stripAnsi } from './strip-ansi';

const DEFAULT_TIMEOUT_MS = 1500;
const STDIN_READ_TIMEOUT_MS = 300;

/** Claude/Cursor may keep stdin open — never block on EOF. */
export async function readStdin(timeoutMs = STDIN_READ_TIMEOUT_MS): Promise<string> {
  if (process.stdin.isTTY) {
    return '';
  }

  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(hardTimer);
      clearTimeout(idleTimer);
      process.stdin.removeListener('data', onData);
      process.stdin.removeListener('end', onEnd);
      process.stdin.removeListener('error', onEnd);
      if (!process.stdin.destroyed) {
        process.stdin.pause();
      }
      resolve(Buffer.concat(chunks).toString('utf8'));
    };

    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    const onData = (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      // Hosts often leave stdin open after one JSON line — don't wait for EOF.
      idleTimer = setTimeout(finish, 25);
    };

    const onEnd = () => finish();

    const hardTimer = setTimeout(finish, timeoutMs);

    process.stdin.on('data', onData);
    process.stdin.on('end', onEnd);
    process.stdin.on('error', onEnd);
    process.stdin.resume();
  });
}

function parseArgs(args: string[]): { workspace?: string } {
  let workspace: string | undefined;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--workspace') {
      workspace = args[++i];
    }
  }
  return { workspace };
}

async function fetchDisplay(
  backendUrl: string,
  workspaceRoot: string,
  sessionId: string | undefined,
  timeoutMs: number,
): Promise<DeckDisplay | null> {
  const params = new URLSearchParams({ workspaceRoot });
  if (sessionId) {
    params.set('sessionId', sessionId);
  }
  const url = `${backendUrl}/api/scope/display?${params.toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { success?: boolean; data?: DeckDisplay };
    return body.success && body.data ? body.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function readSidecarEntry(sessionId: string | undefined) {
  if (!sessionId) {
    return null;
  }

  for (const filePath of listBindingsFileCandidates()) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = BindingsFileSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        continue;
      }
      const entry = parsed.data[sessionId];
      if (entry) {
        return entry;
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}

function readSidecarLine(sessionId: string | undefined): string | null {
  const entry = readSidecarEntry(sessionId);
  if (!entry) {
    return null;
  }
  return formatDisplayLine(entry.deckName, entry.cardCounts, { updatedAt: entry.updatedAt });
}

function shouldUseApiDisplay(display: DeckDisplay): boolean {
  return Boolean(display.deckName && display.source !== 'unbound');
}

function resolveBackendPorts(): number[] {
  if (process.env.AGENT_DECK_PORT?.trim()) {
    return [parseCliBackendPort(process.env.AGENT_DECK_PORT)];
  }

  if (process.env.AGENT_DECK_DEV === '1' || process.env.AGENT_DECK_DEV === 'true') {
    return [8000, CLI_DEFAULT_BACKEND_PORT];
  }

  // Published `agent-deck start` first — avoids 1.5s dead port wait on every refresh.
  return [CLI_DEFAULT_BACKEND_PORT, 8000];
}

export function resolveStatuslineWorkspace(args: string[], stdin: string): string {
  const { workspace: workspaceArg } = parseArgs(args);
  const explicit = workspaceArg?.trim();
  if (explicit) {
    return explicit;
  }

  if (stdin.trim()) {
    try {
      const payload = StatusLinePayloadSchema.safeParse(JSON.parse(stdin));
      if (payload.success) {
        const resolved = resolveStatusLineWorkspace(payload.data, process.cwd());
        if (resolved) {
          return resolved;
        }
      }
    } catch {
      // ignore malformed stdin — fall back to cwd
    }
  }

  return process.cwd();
}

export function resolveStatuslineSessionId(args: string[], stdin: string): string | undefined {
  if (stdin.trim()) {
    try {
      const payload = StatusLinePayloadSchema.safeParse(JSON.parse(stdin));
      if (payload.success) {
        return resolveStatusLineSessionId(payload.data);
      }
    } catch {
      // ignore malformed stdin
    }
  }

  return undefined;
}

export async function runStatusline(args: string[]): Promise<number> {
  const { workspace: workspaceArg } = parseArgs(args);
  const stdin = workspaceArg?.trim() ? '' : await readStdin();
  const workspaceRoot = resolveStatuslineWorkspace(args, stdin);
  const sessionId = resolveStatuslineSessionId(args, stdin);

  const host = process.env.AGENT_DECK_HOST ?? '127.0.0.1';
  const backendPorts = resolveBackendPorts();
  const timeoutMs =
    Number.parseInt(process.env.AGENT_DECK_STATUSLINE_TIMEOUT_MS ?? '', 10) || DEFAULT_TIMEOUT_MS;

  for (const backendPort of backendPorts) {
    const backendUrl = `http://${host}:${backendPort}`;
    const display = await fetchDisplay(backendUrl, workspaceRoot, sessionId, timeoutMs);
    if (display && shouldUseApiDisplay(display)) {
      printStatusLine(display.displayLine);
      return 0;
    }
    if (display && display.source === 'repo_manifest') {
      printStatusLine(display.displayLine);
      return 0;
    }
  }

  const sidecarLine = readSidecarLine(sessionId);
  if (sidecarLine) {
    printStatusLine(sidecarLine);
    return 0;
  }

  const offlineEntry = readSidecarEntry(sessionId);
  printStatusLine(
    formatDisplayLine(
      offlineEntry?.deckName ?? null,
      offlineEntry?.cardCounts ?? { mcp: 0, credentials: 0, playbooks: 0 },
      {
        offline: true,
        updatedAt: offlineEntry?.updatedAt,
      },
    ),
  );
  return 0;
}

function printStatusLine(line: string): void {
  process.stdout.write(`${stripAnsi(line)}\n`);
}
