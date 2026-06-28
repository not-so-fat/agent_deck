import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from './database';

describe('DatabaseManager credentials', () => {
  let dbManager: DatabaseManager;

  beforeEach(() => {
    dbManager = new DatabaseManager(':memory:');
  });

  afterEach(() => {
    dbManager.close();
  });

  it('creates and links credentials to decks', async () => {
    const deck = await dbManager.createDeck({ name: 'Test Deck' });
    await dbManager.createCredential({
      id: 'cred_linear',
      label: 'Linear',
      scheme: 'bearer',
      envName: 'LINEAR_API_KEY',
      keychainAccount: 'cred_linear',
      tags: [],
      hasSecret: true,
    });

    await dbManager.addCredentialToDeck({
      deckId: deck.id,
      credentialId: 'cred_linear',
    });

    const loadedDeck = await dbManager.getDeck(deck.id);
    expect(loadedDeck?.credentials).toHaveLength(1);
    expect(loadedDeck?.credentials[0].id).toBe('cred_linear');
  });
});
