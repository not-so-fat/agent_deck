/**
 * Agent Deck–owned OAuth apps (shared client credentials).
 *
 * Client IDs may eventually be committed; secrets must only come from environment
 * variables or a hosted secrets store — never from the repo.
 *
 * When both ID and secret are set for a provider, users get one-click Connect
 * (setupMode: managed) instead of BYO app registration.
 */

export type SharedOAuthCredentials = {
  clientId: string;
  clientSecret: string;
  /** Who operates this OAuth app (shown in UI). */
  operator: 'agent-deck';
};

const PROVIDER_ENV: Record<
  string,
  { clientIdKey: string; clientSecretKey: string }
> = {
  slack: {
    clientIdKey: 'AGENT_DECK_SLACK_CLIENT_ID',
    clientSecretKey: 'AGENT_DECK_SLACK_CLIENT_SECRET',
  },
};

export function getSharedOAuthCredentials(provider: string): SharedOAuthCredentials | null {
  const keys = PROVIDER_ENV[provider];
  if (!keys) {
    return null;
  }

  const clientId = process.env[keys.clientIdKey]?.trim();
  const clientSecret = process.env[keys.clientSecretKey]?.trim();
  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret, operator: 'agent-deck' };
}

export function hasSharedOAuthApp(provider: string): boolean {
  return getSharedOAuthCredentials(provider) !== null;
}
