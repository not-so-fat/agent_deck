import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DatabaseManager } from '../models/database';
import { MemorySecretStore } from './secret-store';
import { OAuthClientSecretVault } from './oauth-client-secret-vault';

describe('OAuthClientSecretVault', () => {
  let db: DatabaseManager;
  let vault: OAuthClientSecretVault;

  beforeEach(async () => {
    db = new DatabaseManager(':memory:');
    vault = new OAuthClientSecretVault(new MemorySecretStore(), db);
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

  it('stores secrets outside sqlite', async () => {
    const [service] = await db.getAllServices();
    await vault.set(service!.id, 'top-secret');

    const row = await db.getService(service!.id);
    expect(row?.oauthClientSecret).toBe('');
    expect(await vault.get(service!.id)).toBe('top-secret');
  });

  it('migrates legacy plaintext from sqlite on first read', async () => {
    const [service] = await db.getAllServices();
    await db.updateService(service!.id, { oauthClientSecret: 'legacy-secret' });

    expect(await vault.get(service!.id, 'legacy-secret')).toBe('legacy-secret');

    const row = await db.getService(service!.id);
    expect(row?.oauthClientSecret).toBe('');
    expect(await vault.get(service!.id)).toBe('legacy-secret');
  });
});
