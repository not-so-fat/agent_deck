import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseManager } from '../models/database';
import { resolveDeckRef } from './deck-resolve';

describe('resolveDeckRef', () => {
  let dbPath: string;
  let db: DatabaseManager;

  beforeEach(async () => {
    dbPath = path.join(os.tmpdir(), `agent-deck-resolve-${Date.now()}.db`);
    db = new DatabaseManager(dbPath);
    await db.createDeck({ name: 'dev', isActive: false });
    await db.createDeck({ name: 'product', isActive: false });
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dbPath, { force: true });
  });

  it('resolves by id and by case-insensitive name', async () => {
    const decks = await db.getAllDecks();
    const dev = decks.find((deck) => deck.name === 'dev');
    expect(dev).toBeTruthy();

    const byId = await resolveDeckRef(db, dev!.id);
    expect(byId?.name).toBe('dev');

    const byName = await resolveDeckRef(db, 'DEV');
    expect(byName?.id).toBe(dev!.id);
  });

  it('returns null for unknown or ambiguous refs', async () => {
    expect(await resolveDeckRef(db, 'missing')).toBeNull();
    expect(await resolveDeckRef(db, '')).toBeNull();
  });
});
