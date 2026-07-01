import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseManager } from '../models/database';
import { upsertBindingForWorkspace } from './bindings-sidecar';
import { resolveDeckDisplay } from './display';

describe('resolveDeckDisplay', () => {
  const originalEnv = { ...process.env };
  let tempDir: string;
  let db: DatabaseManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-deck-display-'));
    process.env.AGENT_DECK_HOME = tempDir;
    delete process.env.AGENT_DECK_DECK_ID;

    const dbPath = path.join(tempDir, 'agent_deck.db');
    db = new DatabaseManager(dbPath);
  });

  afterEach(async () => {
    await db.close();
    process.env = { ...originalEnv };
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('prefers sidecar over repo manifest', async () => {
    const workspace = path.join(tempDir, 'repo');
    await fs.mkdir(path.join(workspace, '.agent-deck'), { recursive: true });

    const manifestDeck = await db.createDeck({ name: 'Manifest Deck', description: '' });
    const sidecarDeck = await db.createDeck({ name: 'Session Deck', description: '' });

    await fs.writeFile(
      path.join(workspace, '.agent-deck', 'deck.yaml'),
      `deck_id: ${manifestDeck.id}\n`,
      'utf8',
    );

    await upsertBindingForWorkspace(workspace, {
      deckId: sidecarDeck.id,
      deckName: sidecarDeck.name,
      source: 'session_override',
      updatedAt: new Date().toISOString(),
      cardCounts: { mcp: 0, credentials: 0, playbooks: 0 },
    });

    const display = await resolveDeckDisplay(workspace, db);
    expect(display.deckId).toBe(sidecarDeck.id);
    expect(display.source).toBe('session_override');
    expect(display.displayLine).toContain('Session Deck');
  });

  it('falls back to repo manifest when sidecar is absent', async () => {
    const workspace = path.join(tempDir, 'repo-manifest');
    await fs.mkdir(path.join(workspace, '.agent-deck'), { recursive: true });

    const deck = await db.createDeck({ name: 'Manifest Deck', description: '' });
    await fs.writeFile(
      path.join(workspace, '.agent-deck', 'deck.yaml'),
      `deck_id: ${deck.id}\n`,
      'utf8',
    );

    const display = await resolveDeckDisplay(workspace, db);
    expect(display.deckId).toBe(deck.id);
    expect(display.source).toBe('repo_manifest');
  });

  it('returns unbound when nothing resolves', async () => {
    const workspace = path.join(tempDir, 'empty');
    await fs.mkdir(workspace, { recursive: true });

    const display = await resolveDeckDisplay(workspace, db);
    expect(display.deckId).toBeNull();
    expect(display.source).toBe('unbound');
    expect(display.displayLine).toBe('◆ —');
  });
});
