import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseManager } from '../models/database';
import { upsertWorkspaceDisplayBinding } from './bindings-sidecar';
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

  it('uses workspace sidecar regardless of host session_id', async () => {
    const workspace = path.join(tempDir, 'repo');
    const manifestDeck = await db.createDeck({ name: 'Manifest Deck', description: '' });
    const boundDeck = await db.createDeck({ name: 'Task Management', description: '' });

    await fs.mkdir(path.join(workspace, '.agent-deck'), { recursive: true });
    await fs.writeFile(
      path.join(workspace, '.agent-deck', 'deck.yaml'),
      `deck_id: ${manifestDeck.id}\n`,
      'utf8',
    );

    await upsertWorkspaceDisplayBinding(workspace, {
      deckId: boundDeck.id,
      deckName: boundDeck.name,
      source: 'session_override',
      updatedAt: '2026-07-02T15:33:00.000Z',
      cardCounts: { mcp: 4, credentials: 0, playbooks: 4 },
      workspaceRoot: workspace,
    });

    const display = await resolveDeckDisplay(
      { sessionId: 'claude-code-session-unrelated', workspaceRoot: workspace },
      db,
    );
    expect(display.deckId).toBe(boundDeck.id);
    expect(display.displayLine).toContain('Task Management');
    expect(display.displayLine).toContain('(updated');
  });

  it('ignores stale MCP session UUID keys when workspace sidecar is absent', async () => {
    const workspace = path.join(tempDir, 'repo-manifest');
    await fs.mkdir(path.join(workspace, '.agent-deck'), { recursive: true });

    const deck = await db.createDeck({ name: 'Manifest Deck', description: '' });
    await fs.writeFile(
      path.join(workspace, '.agent-deck', 'deck.yaml'),
      `deck_id: ${deck.id}\n`,
      'utf8',
    );

    const bindingsPath = path.join(tempDir, 'bindings.json');
    await fs.writeFile(
      bindingsPath,
      JSON.stringify({
        '123e4567-e89b-12d3-a456-426614174000': {
          deckId: '223e4567-e89b-12d3-a456-426614174001',
          deckName: 'Stale MCP Session Deck',
          source: 'session_override',
          updatedAt: '2026-01-01T00:00:00.000Z',
          cardCounts: { mcp: 1, credentials: 0, playbooks: 0 },
        },
      }),
      'utf8',
    );

    const display = await resolveDeckDisplay(
      { sessionId: '123e4567-e89b-12d3-a456-426614174000', workspaceRoot: workspace },
      db,
    );
    expect(display.deckId).toBe(deck.id);
    expect(display.source).toBe('repo_manifest');
  });

  it('falls back to repo manifest when workspace sidecar is absent', async () => {
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
