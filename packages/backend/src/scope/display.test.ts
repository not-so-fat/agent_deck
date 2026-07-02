import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseManager } from '../models/database';
import { upsertBindingForSession } from './bindings-sidecar';
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

  it('falls back to legacy workspace sidecar when session is absent', async () => {
    const workspace = path.join(tempDir, 'repo');
    const manifestDeck = await db.createDeck({ name: 'Manifest Deck', description: '' });
    const legacyDeck = await db.createDeck({ name: 'Legacy Deck', description: '' });

    await fs.mkdir(path.join(workspace, '.agent-deck'), { recursive: true });
    await fs.writeFile(
      path.join(workspace, '.agent-deck', 'deck.yaml'),
      `deck_id: ${manifestDeck.id}\n`,
      'utf8',
    );

    const bindingsPath = path.join(tempDir, 'bindings.json');
    await fs.writeFile(
      bindingsPath,
      JSON.stringify({
        [workspace]: {
          deckId: legacyDeck.id,
          deckName: legacyDeck.name,
          source: 'session_override',
          updatedAt: '2026-07-02T07:20:00.000Z',
          cardCounts: { mcp: 0, credentials: 0, playbooks: 0 },
        },
      }),
      'utf8',
    );

    const display = await resolveDeckDisplay(
      { sessionId: 'unknown-session', workspaceRoot: workspace },
      db,
    );
    expect(display.deckId).toBe(legacyDeck.id);
    expect(display.displayLine).toContain('Legacy Deck');
  });

  it('prefers session sidecar over repo manifest', async () => {
    const workspace = path.join(tempDir, 'repo');
    const sessionId = '123e4567-e89b-12d3-a456-426614174000';
    await fs.mkdir(path.join(workspace, '.agent-deck'), { recursive: true });

    const manifestDeck = await db.createDeck({ name: 'Manifest Deck', description: '' });
    const sessionDeck = await db.createDeck({ name: 'Session Deck', description: '' });

    await fs.writeFile(
      path.join(workspace, '.agent-deck', 'deck.yaml'),
      `deck_id: ${manifestDeck.id}\n`,
      'utf8',
    );

    await upsertBindingForSession(sessionId, {
      deckId: sessionDeck.id,
      deckName: sessionDeck.name,
      source: 'session_override',
      updatedAt: '2026-07-02T07:20:00.000Z',
      cardCounts: { mcp: 0, credentials: 0, playbooks: 0 },
      workspaceRoot: workspace,
    });

    const display = await resolveDeckDisplay({ sessionId, workspaceRoot: workspace }, db);
    expect(display.deckId).toBe(sessionDeck.id);
    expect(display.source).toBe('session_override');
    expect(display.displayLine).toContain('Session Deck');
    expect(display.displayLine).toContain('(updated');
  });

  it('falls back to repo manifest when session sidecar is absent', async () => {
    const workspace = path.join(tempDir, 'repo-manifest');
    await fs.mkdir(path.join(workspace, '.agent-deck'), { recursive: true });

    const deck = await db.createDeck({ name: 'Manifest Deck', description: '' });
    await fs.writeFile(
      path.join(workspace, '.agent-deck', 'deck.yaml'),
      `deck_id: ${deck.id}\n`,
      'utf8',
    );

    const display = await resolveDeckDisplay({ workspaceRoot: workspace }, db);
    expect(display.deckId).toBe(deck.id);
    expect(display.source).toBe('repo_manifest');
  });

  it('returns unbound when nothing resolves', async () => {
    const workspace = path.join(tempDir, 'empty');
    await fs.mkdir(workspace, { recursive: true });

    const display = await resolveDeckDisplay({ workspaceRoot: workspace }, db);
    expect(display.deckId).toBeNull();
    expect(display.source).toBe('unbound');
    expect(display.displayLine).toBe('◆ —');
  });
});
