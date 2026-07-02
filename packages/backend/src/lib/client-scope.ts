import { FastifyRequest } from 'fastify';
import {
  AGENT_DECK_CLIENT_HEADER,
  AGENT_DECK_DASHBOARD_CLIENT,
  Deck,
  Service,
} from '@agent-deck/shared';

export type ClientScope = 'dashboard' | 'agent';

function stripAuthorizationHeader(
  headers?: Record<string, string> | null,
): Record<string, string> | undefined {
  if (!headers) {
    return undefined;
  }
  const next = { ...headers };
  delete next.Authorization;
  delete next.authorization;
  return Object.keys(next).length > 0 ? next : undefined;
}

/** Remove secrets from service payloads returned to agent clients. */
export function sanitizeServiceForAgent(service: Service): Service {
  return {
    ...service,
    oauthClientSecret: undefined,
    oauthAccessToken: undefined,
    oauthRefreshToken: undefined,
    oauthState: undefined,
    headers: stripAuthorizationHeader(service.headers),
    localEnv: undefined,
  };
}

function sanitizeDeckForAgent(deck: Deck): Deck {
  return {
    ...deck,
    services: deck.services?.map(sanitizeServiceForAgent) ?? [],
  };
}

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
  const sanitized = sanitizeDeckForAgent(deck);
  if (visibleDeckId && deck.id === visibleDeckId) {
    return sanitized;
  }
  return { ...sanitized, credentials: [], playbooks: [] };
}

/** @deprecated Use applyDeckScope */
export function applyDeckCredentialScope(
  deck: Deck,
  scope: ClientScope,
  visibleDeckId?: string,
): Deck {
  return applyDeckScope(deck, scope, visibleDeckId);
}
