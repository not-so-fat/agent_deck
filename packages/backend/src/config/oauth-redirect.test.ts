import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildLocalOAuthRedirectUri,
  getOAuthRedirectUri,
  isOAuthRedirectHttps,
  resolveLocalOAuthHost,
  resolveLocalOAuthPort,
} from './oauth-redirect';

describe('oauth-redirect', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.AGENT_DECK_OAUTH_REDIRECT_URI;
    delete process.env.AGENT_DECK_PUBLIC_URL;
    delete process.env.AGENT_DECK_HOST;
    delete process.env.AGENT_DECK_PORT;
    delete process.env.HOST;
    delete process.env.PORT;
  });

  afterEach(() => {
    process.env = env;
  });

  it('defaults to loopback host and port 8000', () => {
    expect(resolveLocalOAuthHost()).toBe('127.0.0.1');
    expect(resolveLocalOAuthPort()).toBe(8000);
    expect(getOAuthRedirectUri()).toBe('http://127.0.0.1:8000/api/oauth/callback');
    expect(isOAuthRedirectHttps()).toBe(false);
  });

  it('follows AGENT_DECK_PORT and AGENT_DECK_HOST', () => {
    process.env.AGENT_DECK_PORT = '8010';
    process.env.AGENT_DECK_HOST = '127.0.0.1';
    expect(getOAuthRedirectUri()).toBe('http://127.0.0.1:8010/api/oauth/callback');
  });

  it('falls back to PORT and HOST when agent-deck vars are unset', () => {
    process.env.PORT = '9001';
    process.env.HOST = '127.0.0.1';
    expect(getOAuthRedirectUri()).toBe('http://127.0.0.1:9001/api/oauth/callback');
  });

  it('prefers AGENT_DECK_PORT over PORT', () => {
    process.env.AGENT_DECK_PORT = '8010';
    process.env.PORT = '9001';
    expect(resolveLocalOAuthPort()).toBe(8010);
  });

  it('ignores invalid port values', () => {
    process.env.AGENT_DECK_PORT = 'not-a-port';
    expect(resolveLocalOAuthPort()).toBe(8000);
  });

  it('buildLocalOAuthRedirectUri supports custom paths', () => {
    expect(buildLocalOAuthRedirectUri('/api/oauth/stytch/callback')).toBe(
      'http://127.0.0.1:8000/api/oauth/stytch/callback',
    );
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
