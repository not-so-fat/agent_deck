import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DatabaseManager } from '../models/database';
import { MemorySecretStore } from './secret-store';
import { OAuthTokenVault } from './oauth-token-vault';

describe('OAuthTokenVault', () => {
  let db: DatabaseManager;
  let vault: OAuthTokenVault;

  beforeEach(async () => {
    db = new DatabaseManager(':memory:');
    vault = new OAuthTokenVault(new MemorySecretStore(), db);
    await db.createService({
      name: 'Slack',
      type: 'mcp',
      url: 'https://mcp.slack.com/mcp',
      oauthClientId: 'slack-client',
    });
  });

  afterEach(() => {
    db.close();
  });

  it('stores tokens outside sqlite', async () => {
    const [service] = await db.getAllServices();
    await vault.set(service!.id, 'access-token', 'refresh-token', new Date().toISOString());

    const row = await db.getService(service!.id);
    expect(row?.oauthAccessToken).toBeFalsy();
    expect(row?.oauthRefreshToken).toBeFalsy();
    expect(row?.oauthHasToken).toBe(true);
    expect(row?.headers?.Authorization).toBeUndefined();

    const bundle = await vault.get(service!.id);
    expect(bundle?.accessToken).toBe('access-token');
    expect(bundle?.refreshToken).toBe('refresh-token');
  });

  it('migrates legacy plaintext from sqlite on first read', async () => {
    const [service] = await db.getAllServices();
    const legacyStmt = (db as any).db.prepare(`
      UPDATE services SET
        oauth_access_token = @access,
        oauth_refresh_token = @refresh,
        headers = @headers
      WHERE id = @id
    `);
    legacyStmt.run({
      id: service!.id,
      access: 'legacy-access',
      refresh: 'legacy-refresh',
      headers: JSON.stringify({ Authorization: 'Bearer legacy-access' }),
    });

    expect(
      await vault.get(service!.id, 'legacy-access', 'legacy-refresh'),
    ).toEqual({
      accessToken: 'legacy-access',
      refreshToken: 'legacy-refresh',
    });

    const row = await db.getService(service!.id);
    expect(row?.oauthAccessToken).toBeFalsy();
    expect(row?.oauthRefreshToken).toBeFalsy();
    expect(row?.headers?.Authorization).toBeUndefined();
    expect(await vault.get(service!.id)).toEqual({
      accessToken: 'legacy-access',
      refreshToken: 'legacy-refresh',
    });
  });

  it('clears metadata when tokens are deleted', async () => {
    const [service] = await db.getAllServices();
    const expiresAt = new Date(Date.now() + 3600_000).toISOString();
    await vault.set(service!.id, 'access-token', undefined, expiresAt);

    await vault.delete(service!.id);

    const row = await db.getService(service!.id);
    expect(row?.oauthHasToken).toBe(false);
    expect(row?.oauthTokenExpiresAt).toBeNull();
    expect(await vault.has(service!.id)).toBe(false);
  });
});
