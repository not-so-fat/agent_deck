import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseManager } from '../models/database';
import { LiveDisplayRegistry } from './live-display-registry';
import { resolveDeckDisplay } from './display';

describe('resolveDeckDisplay', () => {
  const originalEnv = { ...process.env };
  let tempDir: string;
  let db: DatabaseManager;
  let registry: LiveDisplayRegistry;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-deck-display-'));
    process.env.AGENT_DECK_HOME = tempDir;
    delete process.env.AGENT_DECK_DECK_ID;

    const dbPath = path.join(tempDir, 'agent_deck.db');
    db = new DatabaseManager(dbPath);
    registry = new LiveDisplayRegistry();
  });

  afterEach(async () => {
    await db.close();
    process.env = { ...originalEnv };
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('shows live MCP bind for workspace', async () => {
    const workspace = path.join(tempDir, 'repo');
    const boundDeck = await db.createDeck({ name: 'Task Management', description: '' });

    registry.upsert({
      mcpSessionId: 'mcp-session-1',
      workspaceRoot: workspace,
      deckId: boundDeck.id,
      deckName: boundDeck.name,
      source: 'session_override',
      updatedAt: '2026-07-02T15:33:00.000Z',
      cardCounts: { mcp: 4, credentials: 0, playbooks: 4 },
    });

    const display = await resolveDeckDisplay({ workspaceRoot: workspace }, db, registry);
    expect(display.deckId).toBe(boundDeck.id);
    expect(display.displayLine).toContain('Task Management');
    expect(display.displayLine).toContain('(updated');
  });

  it('returns unbound when deck.yaml exists on disk but no live session', async () => {
    const workspace = path.join(tempDir, 'repo-manifest');
    await fs.mkdir(path.join(workspace, '.agent-deck'), { recursive: true });

    const deck = await db.createDeck({ name: 'Manifest Deck', description: '' });
    await fs.writeFile(
      path.join(workspace, '.agent-deck', 'deck.yaml'),
      `deck_id: ${deck.id}\n`,
      'utf8',
    );

    const display = await resolveDeckDisplay({ workspaceRoot: workspace }, db, registry);
    expect(display.deckId).toBeNull();
    expect(display.source).toBe('unbound');
    expect(display.displayLine).toContain('◆ Unbound — bind a deck to use Agent Deck');
  });

  it('returns unbound for empty workspace', async () => {
    const workspace = path.join(tempDir, 'empty');
    await fs.mkdir(workspace, { recursive: true });

    const display = await resolveDeckDisplay({ workspaceRoot: workspace }, db, registry);
    expect(display.deckId).toBeNull();
    expect(display.source).toBe('unbound');
    expect(display.displayLine).toContain('◆ Unbound — bind a deck to use Agent Deck');
  });
});
