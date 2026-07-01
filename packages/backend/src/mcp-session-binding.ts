import path from 'node:path';
import {
  AGENT_DECK_AGENT_CLIENT,
  AGENT_DECK_CLIENT_HEADER,
  AGENT_DECK_DECK_ID_HEADER,
  AGENT_DECK_WORKSPACE_HEADER,
} from '@agent-deck/shared';

export type DeckBindingSource = 'session_override' | 'env' | 'repo_manifest';

export type SessionBindingSnapshot = {
  workspaceRoot?: string;
  deckId?: string;
  deckSource?: 'session_override' | 'env';
};

/** Per-MCP-session workspace + deck override (deck id wins over repo deck.yaml on the backend). */
export class McpSessionBindingStore {
  private workspaceBySession = new Map<string, string>();
  private deckIdBySession = new Map<string, string>();
  private readonly defaultWorkspace?: string;
  private readonly defaultDeckId?: string;

  constructor(env: { workspace?: string; deckId?: string } = {}) {
    this.defaultWorkspace = env.workspace?.trim() || undefined;
    this.defaultDeckId = env.deckId?.trim() || undefined;
  }

  setWorkspace(sessionId: string, workspaceRoot: string): void {
    this.workspaceBySession.set(sessionId, path.resolve(workspaceRoot.trim()));
  }

  setDeckId(sessionId: string, deckId: string): void {
    this.deckIdBySession.set(sessionId, deckId);
  }

  clearDeckId(sessionId: string): void {
    this.deckIdBySession.delete(sessionId);
  }

  clearSession(sessionId: string): void {
    this.workspaceBySession.delete(sessionId);
    this.deckIdBySession.delete(sessionId);
  }

  getWorkspace(sessionId: string): string | undefined {
    return this.workspaceBySession.get(sessionId) ?? this.defaultWorkspace;
  }

  /** Session or env deck override. When set, backend prefers this over repo deck.yaml. */
  getDeckOverride(sessionId: string): string | undefined {
    return this.deckIdBySession.get(sessionId) ?? this.defaultDeckId;
  }

  hasSessionDeckOverride(sessionId: string): boolean {
    return this.deckIdBySession.has(sessionId);
  }

  getBinding(sessionId: string): SessionBindingSnapshot {
    const sessionDeck = this.deckIdBySession.get(sessionId);
    const deckId = sessionDeck ?? this.defaultDeckId;
    return {
      workspaceRoot: this.getWorkspace(sessionId),
      deckId,
      deckSource: sessionDeck ? 'session_override' : this.defaultDeckId ? 'env' : undefined,
    };
  }

  getAgentHeaders(sessionId: string): Record<string, string> {
    const headers: Record<string, string> = {
      [AGENT_DECK_CLIENT_HEADER]: AGENT_DECK_AGENT_CLIENT,
      Accept: 'application/json',
    };

    const workspace = this.getWorkspace(sessionId);
    if (workspace) {
      headers[AGENT_DECK_WORKSPACE_HEADER] = workspace;
    }

    const deckId = this.getDeckOverride(sessionId);
    if (deckId) {
      headers[AGENT_DECK_DECK_ID_HEADER] = deckId;
    }

    return headers;
  }
}

export function resolveDeckBindingSource(
  binding: SessionBindingSnapshot,
  manifestDeckId?: string,
): DeckBindingSource {
  if (binding.deckSource === 'session_override' || binding.deckSource === 'env') {
    return binding.deckSource === 'env' ? 'env' : 'session_override';
  }
  if (manifestDeckId) {
    return 'repo_manifest';
  }
  return 'session_override';
}
