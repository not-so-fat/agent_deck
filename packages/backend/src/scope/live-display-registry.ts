import path from 'node:path';
import {
  DeckCardCounts,
  DeckDisplaySource,
  normalizeWorkspaceRoot,
} from '@agent-deck/shared';

export type LiveDisplayEntry = {
  mcpSessionId: string;
  workspaceRoot: string;
  deckId: string;
  deckName: string;
  source: Exclude<DeckDisplaySource, 'unbound'>;
  cardCounts: DeckCardCounts;
  updatedAt: string;
};

/** In-memory registry of live MCP session binds (status line reads reality only). */
export class LiveDisplayRegistry {
  private bySessionId = new Map<string, LiveDisplayEntry>();

  upsert(entry: LiveDisplayEntry): void {
    this.bySessionId.set(entry.mcpSessionId, entry);
  }

  remove(mcpSessionId: string): void {
    this.bySessionId.delete(mcpSessionId);
  }

  /** Nearest workspace bind walking up from workspaceRoot (monorepo walk-up). */
  findForWorkspace(workspaceRoot: string): LiveDisplayEntry | null {
    let current = normalizeWorkspaceRoot(workspaceRoot);
    while (true) {
      let best: LiveDisplayEntry | null = null;
      for (const entry of this.bySessionId.values()) {
        if (normalizeWorkspaceRoot(entry.workspaceRoot) !== current) {
          continue;
        }
        if (!best || entry.updatedAt > best.updatedAt) {
          best = entry;
        }
      }
      if (best) {
        return best;
      }

      const parent = path.dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
    return null;
  }
}
