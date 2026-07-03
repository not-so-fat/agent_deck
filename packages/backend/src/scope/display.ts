import {
  BindingEntry,
  DeckDisplay,
  DeckDisplaySource,
  countDeckCards,
  formatDisplayLine,
} from '@agent-deck/shared';
import { DatabaseManager } from '../models/database';
import { loadRepoDeckManifest } from './repo-deck';
import { readBindingForDisplay } from './bindings-sidecar';

const EMPTY_COUNTS = { mcp: 0, credentials: 0, playbooks: 0 };

export type ResolveDeckDisplayInput = {
  sessionId?: string;
  workspaceRoot: string;
};

function buildDisplay(
  input: ResolveDeckDisplayInput,
  source: DeckDisplaySource,
  deck: { id: string; name: string; services?: Array<{ type?: string }>; credentials?: unknown[]; playbooks?: unknown[] } | null,
  options?: { agentDeckOnline?: boolean; sidecar?: BindingEntry | null },
): DeckDisplay {
  const agentDeckOnline = options?.agentDeckOnline ?? true;
  const cardCounts = deck ? countDeckCards(deck) : options?.sidecar?.cardCounts ?? EMPTY_COUNTS;
  const deckName = deck?.name ?? options?.sidecar?.deckName ?? null;
  const deckId = deck?.id ?? options?.sidecar?.deckId ?? null;
  const updatedAt = options?.sidecar?.updatedAt;

  return {
    workspaceRoot: input.workspaceRoot,
    sessionId: input.sessionId ?? null,
    deckId,
    deckName,
    source,
    cardCounts,
    oauthWarningCount: options?.sidecar?.oauthWarningCount,
    agentDeckOnline,
    updatedAt,
    displayLine: formatDisplayLine(deckName, cardCounts, {
      offline: !agentDeckOnline,
      updatedAt,
    }),
  };
}

/** Resolve bound-deck display for terminal status line (workspace sidecar → env → manifest → unbound). */
export async function resolveDeckDisplay(
  input: ResolveDeckDisplayInput,
  db: DatabaseManager,
): Promise<DeckDisplay> {
  const normalizedRoot = input.workspaceRoot.trim();
  const sessionId = input.sessionId?.trim();

  const sidecar = await readBindingForDisplay({ sessionId, workspaceRoot: normalizedRoot });
  if (sidecar) {
    const deck = await db.getDeck(sidecar.deckId);
    return buildDisplay({ sessionId, workspaceRoot: normalizedRoot }, sidecar.source, deck, {
      sidecar,
    });
  }

  const envDeckId = process.env.AGENT_DECK_DECK_ID?.trim();
  if (envDeckId) {
    const deck = await db.getDeck(envDeckId);
    if (deck) {
      return buildDisplay({ sessionId, workspaceRoot: normalizedRoot }, 'env', deck);
    }
  }

  const manifest = await loadRepoDeckManifest(normalizedRoot);
  if (manifest) {
    const deck = await db.getDeck(manifest.deck_id);
    if (deck) {
      return buildDisplay({ sessionId, workspaceRoot: normalizedRoot }, 'repo_manifest', deck);
    }
  }

  return buildDisplay({ sessionId, workspaceRoot: normalizedRoot }, 'unbound', null);
}
