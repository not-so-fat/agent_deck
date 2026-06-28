/** HTTP header distinguishing dashboard (human UI) from agent API clients. */
export const AGENT_DECK_CLIENT_HEADER = 'x-agent-deck-client';

/** Value sent by the Agent Deck dashboard for vault management. */
export const AGENT_DECK_DASHBOARD_CLIENT = 'dashboard';

/** Value sent by MCP and other agent integrations (deck-scoped reads only). */
export const AGENT_DECK_AGENT_CLIENT = 'agent';

/** Workspace root for resolving `.agent-deck/deck.yaml` (agent clients). */
export const AGENT_DECK_WORKSPACE_HEADER = 'x-agent-deck-workspace';

/** Direct deck binding when workspace manifest is not used (agent clients). */
export const AGENT_DECK_DECK_ID_HEADER = 'x-agent-deck-deck-id';
