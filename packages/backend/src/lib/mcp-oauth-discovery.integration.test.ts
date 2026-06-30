import { describe, expect, it } from 'vitest';

import { discoverMcpOAuthRequirements } from './mcp-oauth-discovery';

const RUN_LIVE = process.env.RUN_MCP_SMOKE === '1';

const PRESETS = [
  {
    name: 'Linear',
    url: 'https://mcp.linear.app/mcp',
    expectOAuth: true,
    expectAuthUrl: 'https://mcp.linear.app/authorize',
    expectTokenUrl: 'https://mcp.linear.app/token',
    autoSetup: true,
  },
  {
    name: 'GitHub',
    url: 'https://api.githubcopilot.com/mcp/',
    expectOAuth: true,
    expectAuthUrl: 'https://github.com/login/oauth/authorize',
    expectTokenUrl: 'https://github.com/login/oauth/access_token',
  },
  {
    name: 'Notion',
    url: 'https://mcp.notion.com/mcp',
    expectOAuth: true,
    expectAuthUrl: 'https://mcp.notion.com/authorize',
    autoSetup: true,
  },
  {
    name: 'Gmail',
    url: 'https://gmailmcp.googleapis.com/mcp/v1',
    expectOAuth: true,
    expectAuthUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    expectTokenUrl: 'https://oauth2.googleapis.com/token',
  },
  {
    name: 'Slack',
    url: 'https://mcp.slack.com/mcp',
    expectOAuth: true,
    expectAuthUrl: 'https://slack.com/oauth/v2_user/authorize',
    autoSetup: false,
  },
  {
    name: 'Figma',
    url: 'https://mcp.figma.com/mcp',
    expectOAuth: true,
    expectAuthUrl: 'https://www.figma.com/oauth/mcp',
  },
];

describe.skipIf(!RUN_LIVE)('MCP preset OAuth discovery (live)', () => {
  it.each(PRESETS)('discovers OAuth for $name', async (preset) => {
    const oauth = await discoverMcpOAuthRequirements(preset.url);

    expect(oauth.required).toBe(preset.expectOAuth);
    if (preset.expectAuthUrl) {
      expect(oauth.authorizationUrl).toBe(preset.expectAuthUrl);
    }
    if (preset.expectTokenUrl) {
      expect(oauth.tokenUrl).toBe(preset.expectTokenUrl);
    }
  }, 30_000);
});

describe.skipIf(!RUN_LIVE)('MCP preset OAuth auto-setup step 1 (live)', () => {
  it('registers Linear and returns PKCE authorization URL', async () => {
    const { DatabaseManager } = await import('../models/database');
    const { OAuthManager } = await import('../services/oauth-manager');
    const { MCPDiscoveryService } = await import('../services/mcp-discovery-service');

    const db = new DatabaseManager(':memory:');
    const { MemorySecretStore } = await import('../vault/secret-store');
    const { OAuthClientSecretVault } = await import('../vault/oauth-client-secret-vault');
    const { OAuthTokenVault } = await import('../vault/oauth-token-vault');
    const secretStore = new MemorySecretStore();
    const clientSecrets = new OAuthClientSecretVault(secretStore, db);
    const tokens = new OAuthTokenVault(secretStore, db);
    const oauthManager = new OAuthManager(db, clientSecrets, tokens);
    const discoveryService = new MCPDiscoveryService();

    const service = await db.createService({
      name: 'Linear',
      type: 'mcp',
      url: 'https://mcp.linear.app/mcp',
    });

    const mcpDiscovery = await discoveryService.discoverService(service.url);
    expect(mcpDiscovery.oauth.required).toBe(true);

    const registration = await oauthManager.autoRegisterOAuthApp(service.url, {
      clientId: '',
      clientSecret: '',
      authorizationUrl: mcpDiscovery.oauth.authorizationUrl || '',
      tokenUrl: mcpDiscovery.oauth.tokenUrl || '',
      redirectUri: 'http://127.0.0.1:8000/api/oauth/callback',
      scope: mcpDiscovery.oauth.scopesSupported?.join(' ') || 'read write',
    });
    expect(registration.success).toBe(true);
    expect(registration.clientId).toBeTruthy();

    if (registration.clientSecret) {
      await clientSecrets.set(service.id, registration.clientSecret);
    }
    await db.updateService(service.id, {
      oauthClientId: registration.clientId,
      oauthClientSecret: '',
      oauthAuthorizationUrl: mcpDiscovery.oauth.authorizationUrl,
      oauthTokenUrl: mcpDiscovery.oauth.tokenUrl,
      oauthRedirectUri: 'http://127.0.0.1:8000/api/oauth/callback',
      oauthScope: mcpDiscovery.oauth.scopesSupported?.join(' ') || 'read write',
    });

    const { authorizationUrl } = await oauthManager.initiateOAuthFlow({
      serviceId: service.id,
      redirectUri: 'http://127.0.0.1:8000/api/oauth/callback',
    });

    const url = new URL(authorizationUrl);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();

    db.close();
  }, 30_000);
});
