import { FastifyRequest } from 'fastify';
import {
  AGENT_DECK_AGENT_CLIENT,
  AGENT_DECK_CLIENT_HEADER,
  AGENT_DECK_DASHBOARD_CLIENT,
  Deck,
  Service,
} from '@agent-deck/shared';

export type ClientScope = 'dashboard' | 'agent';

const SECRET_HEADER_NAMES = new Set([
  'authorization',
  'x-api-key',
  'api-key',
  'x-auth-token',
  'x-access-token',
]);

function stripSecretHeaders(
  headers?: Record<string, string> | null,
): Record<string, string> | undefined {
  if (!headers) {
    return undefined;
  }
  const next = { ...headers };
  for (const key of Object.keys(next)) {
    if (SECRET_HEADER_NAMES.has(key.toLowerCase())) {
      delete next[key];
    }
  }
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
    headers: stripSecretHeaders(service.headers),
    localEnv: undefined,
  };
}

export function sanitizeDeckForAgent(deck: Deck): Deck {
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

export function requireAgentClient(request: FastifyRequest): void {
  const value = request.headers[AGENT_DECK_CLIENT_HEADER];
  if (typeof value !== 'string' || value.toLowerCase() !== AGENT_DECK_AGENT_CLIENT) {
    throw new AgentClientOnlyError();
  }
}

export class AgentClientOnlyError extends Error {
  constructor(message = 'This operation requires an Agent Deck agent client') {
    super(message);
    this.name = 'AgentClientOnlyError';
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
