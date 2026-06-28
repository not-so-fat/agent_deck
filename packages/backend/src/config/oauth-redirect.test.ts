import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getOAuthRedirectUri, isOAuthRedirectHttps } from './oauth-redirect';

describe('oauth-redirect', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.AGENT_DECK_OAUTH_REDIRECT_URI;
    delete process.env.AGENT_DECK_PUBLIC_URL;
  });

  afterEach(() => {
    process.env = env;
  });

  it('defaults to local http callback', () => {
    expect(getOAuthRedirectUri()).toBe('http://localhost:8000/api/oauth/callback');
    expect(isOAuthRedirectHttps()).toBe(false);
  });

  it('builds redirect from AGENT_DECK_PUBLIC_URL', () => {
    process.env.AGENT_DECK_PUBLIC_URL = 'https://oauth.agent-deck.dev';
    expect(getOAuthRedirectUri()).toBe('https://oauth.agent-deck.dev/api/oauth/callback');
    expect(isOAuthRedirectHttps()).toBe(true);
  });

  it('prefers AGENT_DECK_OAUTH_REDIRECT_URI override', () => {
    process.env.AGENT_DECK_PUBLIC_URL = 'https://wrong.example';
    process.env.AGENT_DECK_OAUTH_REDIRECT_URI =
      'https://abc.ngrok-free.app/api/oauth/callback';
    expect(getOAuthRedirectUri()).toBe('https://abc.ngrok-free.app/api/oauth/callback');
  });
});
