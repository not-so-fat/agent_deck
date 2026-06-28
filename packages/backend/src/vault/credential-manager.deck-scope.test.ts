import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '../models/database';
import { CredentialManager } from '../vault/credential-manager';
import { MemorySecretStore } from '../vault/secret-store';
import { CredentialYamlSync } from '../vault/yaml-sync';

class NoopYamlSync extends CredentialYamlSync {
  async write(): Promise<void> {}
  async remove(): Promise<void> {}
}

describe('CredentialManager deck scope', () => {
  let db: DatabaseManager;
  let manager: CredentialManager;

  beforeEach(async () => {
    process.env.AGENT_DECK_SECRET_STORE = 'memory';
    db = new DatabaseManager(':memory:');
    manager = new CredentialManager(db, new MemorySecretStore(), new NoopYamlSync());

    await manager.create({
      id: 'cred_on_deck',
      label: 'On Deck',
      scheme: 'bearer',
      envName: 'ON_DECK_API_KEY',
      value: 'secret-a',
      tags: [],
    });

    await manager.create({
      id: 'cred_vault_only',
      label: 'Vault Only',
      scheme: 'bearer',
      envName: 'VAULT_ONLY_API_KEY',
      value: 'secret-b',
      tags: [],
    });

    const deck = await db.createDeck({ name: 'Project', isActive: true });
    await manager.addToDeck({ deckId: deck.id, credentialId: 'cred_on_deck' });
  });

  afterEach(() => {
    db.close();
    delete process.env.AGENT_DECK_SECRET_STORE;
  });

  it('lists only credentials on the active deck', async () => {
    const scoped = await manager.listForActiveDeck();
    expect(scoped.map((credential) => credential.id)).toEqual(['cred_on_deck']);
  });

  it('returns credential metadata only when it is on the active deck', async () => {
    expect(await manager.getIfOnActiveDeck('cred_on_deck')).toMatchObject({
      id: 'cred_on_deck',
    });
    expect(await manager.getIfOnActiveDeck('cred_vault_only')).toBeNull();
  });

  it('asserts exec connections belong to the deck', async () => {
    const deck = await db.getActiveDeck();
    expect(deck).not.toBeNull();

    await expect(
      manager.assertCredentialsOnDeck(deck!.id, ['cred_on_deck']),
    ).resolves.toBeUndefined();

    await expect(
      manager.assertCredentialsOnDeck(deck!.id, ['cred_vault_only']),
    ).rejects.toThrow(/not on deck/);
  });
});
