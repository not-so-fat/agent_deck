import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DatabaseManager } from '../models/database';
import { OAuthManager } from './oauth-manager';

describe('OAuthManager PKCE', () => {
  let db: DatabaseManager;
  let oauthManager: OAuthManager;

  beforeEach(async () => {
    db = new DatabaseManager(':memory:');
    oauthManager = new OAuthManager(db);

    await db.createService({
      name: 'Linear',
      type: 'mcp',
      url: 'https://mcp.linear.app/mcp',
      oauthClientId: 'test-client',
      oauthAuthorizationUrl: 'https://mcp.linear.app/authorize',
      oauthTokenUrl: 'https://mcp.linear.app/token',
      oauthRedirectUri: 'http://localhost:8000/api/oauth/callback',
      oauthScope: 'read write',
    });
  });

  afterEach(() => {
    db.close();
  });

  it('includes S256 PKCE params in authorization URL', async () => {
    const services = await db.getAllServices();
    const serviceId = services[0]!.id;

    const { authorizationUrl, state } = await oauthManager.initiateOAuthFlow({
      serviceId,
      redirectUri: 'http://localhost:8000/api/oauth/callback',
    });

    const url = new URL(authorizationUrl);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('state')).toBe(state);
    expect(oauthManager.getOAuthState(state)).toBe(serviceId);
  });

  it('sends code_verifier during token exchange', async () => {
    const services = await db.getAllServices();
    const serviceId = services[0]!.id;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { state } = await oauthManager.initiateOAuthFlow({
      serviceId,
      redirectUri: 'http://localhost:8000/api/oauth/callback',
    });

    await oauthManager.handleOAuthCallback({
      serviceId,
      code: 'auth-code',
      state,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(init.body as string);
    expect(body.get('code_verifier')).toBeTruthy();
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('auth-code');

    vi.unstubAllGlobals();
  });

  it('treats token without expiry as not expired', async () => {
    const services = await db.getAllServices();
    const serviceId = services[0]!.id;

    await db.updateOAuthTokens(serviceId, 'long-lived-token', undefined, undefined);

    expect(await oauthManager.isTokenExpired(serviceId)).toBe(false);
    expect(await oauthManager.getValidAccessToken(serviceId)).toBe('long-lived-token');
  });
});
