import { FastifyRequest } from 'fastify';
import {
  AGENT_DECK_CLIENT_HEADER,
  AGENT_DECK_DASHBOARD_CLIENT,
  Deck,
} from '@agent-deck/shared';

export type ClientScope = 'dashboard' | 'agent';

export function getClientScope(request: FastifyRequest): ClientScope {
  const value = request.headers[AGENT_DECK_CLIENT_HEADER];
  if (typeof value === 'string' && value.toLowerCase() === AGENT_DECK_DASHBOARD_CLIENT) {
    return 'dashboard';
  }
  return 'agent';
}

export function isDashboardClient(request: FastifyRequest): boolean {
  return getClientScope(request) === 'dashboard';
}

export function requireDashboardClient(request: FastifyRequest): void {
  if (!isDashboardClient(request)) {
    throw new DashboardOnlyError();
  }
}

export class DashboardOnlyError extends Error {
  constructor(message = 'This operation requires the Agent Deck dashboard client') {
    super(message);
    this.name = 'DashboardOnlyError';
  }
}

/** Agent clients only see deck-scoped cards for decks other than the bound deck. */
export function applyDeckScope(
  deck: Deck,
  scope: ClientScope,
  visibleDeckId?: string,
): Deck {
  if (scope === 'dashboard') {
    return deck;
  }
  if (visibleDeckId && deck.id === visibleDeckId) {
    return deck;
  }
  return { ...deck, credentials: [], playbooks: [] };
}

/** @deprecated Use applyDeckScope */
export function applyDeckCredentialScope(
  deck: Deck,
  scope: ClientScope,
  visibleDeckId?: string,
): Deck {
  return applyDeckScope(deck, scope, visibleDeckId);
}
