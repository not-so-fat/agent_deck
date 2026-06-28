import { FastifyRequest } from 'fastify';
import {
  AGENT_DECK_DECK_ID_HEADER,
  AGENT_DECK_WORKSPACE_HEADER,
} from '@agent-deck/shared';
import { DatabaseManager } from '../models/database';
import { loadRepoDeckManifest, RepoDeckManifestError } from '../scope/repo-deck';

export class AgentDeckContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentDeckContextError';
  }
}

function headerValue(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Resolve which deck an agent request is scoped to (workspace manifest or explicit deck id). */
export async function resolveAgentDeckId(
  request: FastifyRequest,
  db: DatabaseManager,
): Promise<string> {
  const deckIdHeader = headerValue(request, AGENT_DECK_DECK_ID_HEADER);
  if (deckIdHeader) {
    const deck = await db.getDeck(deckIdHeader);
    if (!deck) {
      throw new AgentDeckContextError(`Deck not found: ${deckIdHeader}`);
    }
    return deckIdHeader;
  }

  const workspaceRoot = headerValue(request, AGENT_DECK_WORKSPACE_HEADER);
  if (workspaceRoot) {
    let manifest;
    try {
      manifest = await loadRepoDeckManifest(workspaceRoot);
    } catch (error) {
      throw new AgentDeckContextError(
        error instanceof RepoDeckManifestError ? error.message : 'Failed to load repo deck manifest',
      );
    }

    if (!manifest) {
      throw new AgentDeckContextError(
        `No ${'.agent-deck/deck.yaml'} found in workspace: ${workspaceRoot}`,
      );
    }

    const deck = await db.getDeck(manifest.deck_id);
    if (!deck) {
      throw new AgentDeckContextError(
        `deck_id in repo manifest not found in Agent Deck: ${manifest.deck_id}`,
      );
    }

    return manifest.deck_id;
  }

  throw new AgentDeckContextError(
    'Agent deck context required: set x-agent-deck-workspace (with .agent-deck/deck.yaml) or x-agent-deck-deck-id',
  );
}
