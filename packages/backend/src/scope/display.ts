import {
  DeckDisplay,
  DeckDisplaySource,
  countDeckCards,
  formatDisplayLine,
} from '@agent-deck/shared';
import { DatabaseManager } from '../models/database';
import { LiveDisplayRegistry } from './live-display-registry';

const EMPTY_COUNTS = { mcp: 0, credentials: 0, playbooks: 0 };
const DEFAULT_MCP_PORT = 1110;

export type ResolveDeckDisplayInput = {
  workspaceRoot: string;
};

async function isMcpServerUp(): Promise<boolean> {
  const host = process.env.AGENT_DECK_HOST?.trim() || '127.0.0.1';
  const parsed = Number.parseInt(process.env.AGENT_DECK_MCP_PORT ?? '', 10);
  const port = Number.isFinite(parsed) ? parsed : DEFAULT_MCP_PORT;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 800);
  try {
    const response = await fetch(`http://${host}:${port}/health`, { signal: controller.signal });
    if (!response.ok) {
      return false;
    }
    const body = (await response.json()) as { service?: string };
    return body.service === 'agent-deck-mcp-server';
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function buildDisplay(
  input: ResolveDeckDisplayInput,
  source: DeckDisplaySource,
  deck: {
    id: string;
    name: string;
    services?: Array<{ type?: string }>;
    credentials?: unknown[];
    playbooks?: unknown[];
  } | null,
  options?: {
    agentDeckOnline?: boolean;
    mcpOnline?: boolean;
    updatedAt?: string;
    liveDeckName?: string | null;
    liveCardCounts?: typeof EMPTY_COUNTS;
  },
): DeckDisplay {
  const agentDeckOnline = options?.agentDeckOnline ?? true;
  const mcpOnline = options?.mcpOnline ?? true;
  const cardCounts = deck ? countDeckCards(deck) : options?.liveCardCounts ?? EMPTY_COUNTS;
  const deckName = deck?.name ?? options?.liveDeckName ?? null;
  const deckId = deck?.id ?? null;
  const updatedAt = options?.updatedAt;

  return {
    workspaceRoot: input.workspaceRoot,
    deckId,
    deckName,
    source,
    cardCounts,
    agentDeckOnline,
    mcpOnline,
    updatedAt,
    displayLine: formatDisplayLine(deckName, cardCounts, {
      offline: !agentDeckOnline,
      mcpOffline: agentDeckOnline && !mcpOnline,
      updatedAt,
    }),
  };
}

/** Resolve bound-deck display from live MCP session registry only (no sidecar/manifest guessing). */
export async function resolveDeckDisplay(
  input: ResolveDeckDisplayInput,
  db: DatabaseManager,
  registry: LiveDisplayRegistry,
): Promise<DeckDisplay> {
  const normalizedRoot = input.workspaceRoot.trim();
  const live = registry.findForWorkspace(normalizedRoot);
  const mcpOnline = live ? true : await isMcpServerUp();
  if (live) {
    const deck = await db.getDeck(live.deckId);
    return buildDisplay({ workspaceRoot: normalizedRoot }, live.source, deck, {
      mcpOnline,
      updatedAt: live.updatedAt,
      liveDeckName: live.deckName,
      liveCardCounts: live.cardCounts,
    });
  }

  return buildDisplay({ workspaceRoot: normalizedRoot }, 'unbound', null, { mcpOnline });
}
