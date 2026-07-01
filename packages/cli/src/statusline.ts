import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  BindingsFileSchema,
  DeckDisplay,
  formatDisplayLine,
  resolveBindingsFilePath,
  resolveStatusLineWorkspace,
  StatusLinePayloadSchema,
} from '@agent-deck/shared';
import { parseCliBackendPort, CLI_DEFAULT_BACKEND_PORT } from './defaults';

const DEFAULT_TIMEOUT_MS = 1500;

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    return '';
  }

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
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
  timeoutMs: number,
): Promise<DeckDisplay | null> {
  const url = `${backendUrl}/api/scope/display?workspaceRoot=${encodeURIComponent(workspaceRoot)}`;
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

function readSidecarLine(workspaceRoot: string): string | null {
  const candidates = new Set<string>();

  if (process.env.AGENT_DECK_HOME?.trim()) {
    candidates.add(path.join(path.resolve(process.env.AGENT_DECK_HOME.trim()), 'bindings.json'));
  }

  candidates.add(resolveBindingsFilePath());

  const home = path.join(os.homedir(), '.agent-deck');
  candidates.add(path.join(home, 'bindings.json'));
  candidates.add(path.join(home, 'dev', 'bindings.json'));

  for (const filePath of candidates) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = BindingsFileSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        continue;
      }
      const entry = parsed.data[workspaceRoot];
      if (entry) {
        return formatDisplayLine(entry.deckName, entry.cardCounts);
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}

function resolveBackendPorts(): number[] {
  if (process.env.AGENT_DECK_PORT?.trim()) {
    return [parseCliBackendPort(process.env.AGENT_DECK_PORT)];
  }

  // Dev monorepo (npm run dev:all) first, then published CLI default.
  return [8000, CLI_DEFAULT_BACKEND_PORT];
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

export async function runStatusline(args: string[]): Promise<number> {
  const { workspace: workspaceArg } = parseArgs(args);
  const stdin = workspaceArg?.trim() ? '' : await readStdin();
  const workspaceRoot = resolveStatuslineWorkspace(args, stdin);

  const host = process.env.AGENT_DECK_HOST ?? '127.0.0.1';
  const backendPorts = resolveBackendPorts();
  const timeoutMs =
    Number.parseInt(process.env.AGENT_DECK_STATUSLINE_TIMEOUT_MS ?? '', 10) || DEFAULT_TIMEOUT_MS;

  for (const backendPort of backendPorts) {
    const backendUrl = `http://${host}:${backendPort}`;
    const display = await fetchDisplay(backendUrl, workspaceRoot, timeoutMs);
    if (display?.displayLine) {
      console.log(display.displayLine);
      return 0;
    }
  }

  const sidecarLine = readSidecarLine(workspaceRoot);
  if (sidecarLine) {
    console.log(sidecarLine);
    return 0;
  }

  console.log(formatDisplayLine(null, { mcp: 0, credentials: 0, playbooks: 0 }, { offline: true }));
  return 0;
}
