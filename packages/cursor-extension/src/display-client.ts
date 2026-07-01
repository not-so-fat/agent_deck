import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  BindingsFileSchema,
  DeckDisplay,
  formatDisplayLine,
  type DeckCardCounts,
} from '@agent-deck/shared';
import * as vscode from 'vscode';

export type DeckStatusResult = {
  displayLine: string;
  tooltip: string;
  backendUrl?: string;
  display?: DeckDisplay;
};

const EMPTY_COUNTS: DeckCardCounts = { mcp: 0, credentials: 0, playbooks: 0 };

function bindingsCandidates(): string[] {
  const home = path.join(os.homedir(), '.agent-deck');
  const candidates = [
    process.env.AGENT_DECK_HOME?.trim(),
    path.join(home, 'dev', 'bindings.json'),
    path.join(home, 'bindings.json'),
  ].filter((value): value is string => Boolean(value?.trim()));

  return [...new Set(candidates.map((value) => (value.endsWith('.json') ? value : path.join(value, 'bindings.json'))))];
}

function readSidecarLine(workspaceRoot: string): string | null {
  for (const filePath of bindingsCandidates()) {
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
      // try next path
    }
  }
  return null;
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

export class DisplayClient {
  getPollIntervalMs(): number {
    return vscode.workspace.getConfiguration('agentDeck').get<number>('pollIntervalMs', 3000);
  }

  getBackendHost(): string {
    return vscode.workspace.getConfiguration('agentDeck').get<string>('backendHost', '127.0.0.1');
  }

  getBackendPorts(): number[] {
    return vscode.workspace.getConfiguration('agentDeck').get<number[]>('backendPorts', [8000, 11111]);
  }

  getRequestTimeoutMs(): number {
    return vscode.workspace.getConfiguration('agentDeck').get<number>('requestTimeoutMs', 1500);
  }

  reloadConfig(): void {
    // reads fresh from workspace configuration on each call
  }

  async resolveDisplay(workspaceRoot: string): Promise<DeckStatusResult> {
    const host = this.getBackendHost();
    const ports = this.getBackendPorts();
    const timeoutMs = this.getRequestTimeoutMs();

    for (const port of ports) {
      const backendUrl = `http://${host}:${port}`;
      const display = await fetchDisplay(backendUrl, workspaceRoot, timeoutMs);
      if (display?.displayLine) {
        return {
          displayLine: display.displayLine,
          tooltip: this.buildTooltip(display, backendUrl),
          backendUrl,
          display,
        };
      }
    }

    const sidecarLine = readSidecarLine(workspaceRoot);
    if (sidecarLine) {
      return {
        displayLine: sidecarLine,
        tooltip: `Bound deck (sidecar cache)\nWorkspace: ${workspaceRoot}`,
      };
    }

    return {
      displayLine: formatDisplayLine(null, EMPTY_COUNTS, { offline: true }),
      tooltip: `Agent Deck API unreachable on ${ports.join(', ')}\nWorkspace: ${workspaceRoot}`,
    };
  }

  async openDashboard(): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const result = workspaceRoot ? await this.resolveDisplay(workspaceRoot) : undefined;
    const host = this.getBackendHost();
    const ports = this.getBackendPorts();
    const url = result?.backendUrl ?? `http://${host}:${ports[0] ?? 8000}`;
    await vscode.env.openExternal(vscode.Uri.parse(url));
  }

  private buildTooltip(display: DeckDisplay, backendUrl: string): string {
    const lines = [
      `Deck: ${display.deckName ?? '—'}`,
      `Source: ${display.source}`,
      `Workspace: ${display.workspaceRoot}`,
      `API: ${backendUrl}`,
      'Click to open dashboard',
    ];
    if (display.deckId) {
      lines.splice(1, 0, `ID: ${display.deckId}`);
    }
    return lines.join('\n');
  }
}
