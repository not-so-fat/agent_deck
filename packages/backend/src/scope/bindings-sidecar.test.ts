import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readBindingForWorkspace, upsertBindingForWorkspace } from './bindings-sidecar';

describe('bindings-sidecar', () => {
  const originalHome = process.env.AGENT_DECK_HOME;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-deck-bindings-'));
    process.env.AGENT_DECK_HOME = tempDir;
  });

  afterEach(async () => {
    if (originalHome === undefined) {
      delete process.env.AGENT_DECK_HOME;
    } else {
      process.env.AGENT_DECK_HOME = originalHome;
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('upserts and reads workspace bindings', async () => {
    const workspace = '/Users/me/repo';
    await upsertBindingForWorkspace(workspace, {
      deckId: '123e4567-e89b-12d3-a456-426614174000',
      deckName: 'Dev Deck',
      source: 'session_override',
      updatedAt: '2026-01-01T00:00:00.000Z',
      cardCounts: { mcp: 2, credentials: 1, playbooks: 0 },
    });

    const entry = await readBindingForWorkspace(workspace);
    expect(entry?.deckName).toBe('Dev Deck');
    expect(entry?.source).toBe('session_override');
  });

  it('finds bindings on parent workspace paths', async () => {
    const workspace = path.resolve('/Users/me/repo');
    await upsertBindingForWorkspace(workspace, {
      deckId: '123e4567-e89b-12d3-a456-426614174000',
      deckName: 'Dev Deck',
      source: 'repo_manifest',
      updatedAt: '2026-01-01T00:00:00.000Z',
      cardCounts: { mcp: 1, credentials: 0, playbooks: 0 },
    });

    const entry = await readBindingForWorkspace(path.join(workspace, 'packages', 'app'));
    expect(entry?.deckName).toBe('Dev Deck');
  });
});
