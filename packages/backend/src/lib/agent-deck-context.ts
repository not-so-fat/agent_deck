import { FastifyRequest } from 'fastify';
import { AGENT_DECK_DECK_ID_HEADER } from '@agent-deck/shared';
import { DatabaseManager } from '../models/database';

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

/** Resolve which deck an agent request is scoped to (session deck id header only). */
export async function resolveAgentDeckId(
  request: FastifyRequest,
  db: DatabaseManager,
): Promise<string> {
  const deckIdHeader = headerValue(request, AGENT_DECK_DECK_ID_HEADER);
  if (!deckIdHeader) {
    throw new AgentDeckContextError(
      'No bound deck — call bind_workspace with deckId (use get_decks to list decks) or switch_bound_deck',
    );
  }

  const deck = await db.getDeck(deckIdHeader);
  if (!deck) {
    throw new AgentDeckContextError(`Deck not found: ${deckIdHeader}`);
  }
  return deckIdHeader;
}
