const DEFAULT_LOCAL_REDIRECT = 'http://localhost:8000/api/oauth/callback';
const OAUTH_CALLBACK_PATH = '/api/oauth/callback';

/**
 * OAuth redirect URI registered with providers (Slack, Google, etc.).
 *
 * Priority:
 * 1. AGENT_DECK_OAUTH_REDIRECT_URI — full URL override
 * 2. AGENT_DECK_PUBLIC_URL + /api/oauth/callback
 * 3. http://localhost:8000/api/oauth/callback (local dev only)
 *
 * Slack public distribution requires HTTPS — set (1) or (2) to an https:// URL.
 */
export function getOAuthRedirectUri(): string {
  const explicit = process.env.AGENT_DECK_OAUTH_REDIRECT_URI?.trim();
  if (explicit) {
    return explicit;
  }

  const publicUrl = process.env.AGENT_DECK_PUBLIC_URL?.trim();
  if (publicUrl) {
    return `${publicUrl.replace(/\/$/, '')}${OAUTH_CALLBACK_PATH}`;
  }

  return DEFAULT_LOCAL_REDIRECT;
}

export function isOAuthRedirectHttps(): boolean {
  return getOAuthRedirectUri().startsWith('https://');
}
