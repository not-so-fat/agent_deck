const OAUTH_CALLBACK_PATH = '/api/oauth/callback';
const DEFAULT_LOCAL_HOST = '127.0.0.1';
const DEFAULT_LOCAL_PORT = 8000;

/** Loopback host for local OAuth callbacks (RFC 8252 prefers IP literal over localhost). */
export function resolveLocalOAuthHost(): string {
  const host = process.env.AGENT_DECK_HOST?.trim() || process.env.HOST?.trim();
  return host || DEFAULT_LOCAL_HOST;
}

/** Backend port — matches CLI (`AGENT_DECK_PORT`) and runtime (`PORT`). */
export function resolveLocalOAuthPort(): number {
  const raw = process.env.AGENT_DECK_PORT?.trim() || process.env.PORT?.trim();
  if (!raw) {
    return DEFAULT_LOCAL_PORT;
  }

  const port = Number.parseInt(raw, 10);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    return DEFAULT_LOCAL_PORT;
  }

  return port;
}

export function buildLocalOAuthRedirectUri(path = OAUTH_CALLBACK_PATH): string {
  const host = resolveLocalOAuthHost();
  const port = resolveLocalOAuthPort();
  return `http://${host}:${port}${path}`;
}

/**
 * OAuth redirect URI registered with providers (Slack, Google, etc.).
 *
 * Priority:
 * 1. AGENT_DECK_OAUTH_REDIRECT_URI — full URL override
 * 2. AGENT_DECK_PUBLIC_URL + /api/oauth/callback
 * 3. http://{host}:{port}/api/oauth/callback (local; host/port from AGENT_DECK_HOST/HOST and AGENT_DECK_PORT/PORT)
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

  return buildLocalOAuthRedirectUri();
}

export function isOAuthRedirectHttps(): boolean {
  return getOAuthRedirectUri().startsWith('https://');
}
