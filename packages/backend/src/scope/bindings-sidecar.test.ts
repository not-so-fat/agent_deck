import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readBindingForSession, upsertBindingForSession } from './bindings-sidecar';

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

  it('upserts and reads session bindings', async () => {
    const sessionId = '123e4567-e89b-12d3-a456-426614174000';
    await upsertBindingForSession(sessionId, {
      deckId: '223e4567-e89b-12d3-a456-426614174001',
      deckName: 'Dev Deck',
      source: 'session_override',
      updatedAt: '2026-01-01T00:00:00.000Z',
      cardCounts: { mcp: 2, credentials: 1, playbooks: 0 },
      workspaceRoot: '/Users/me/repo',
    });

    const entry = await readBindingForSession(sessionId);
    expect(entry?.deckName).toBe('Dev Deck');
    expect(entry?.source).toBe('session_override');
    expect(entry?.workspaceRoot).toBe('/Users/me/repo');
  });

  it('does not share bindings across sessions', async () => {
    const sessionA = '123e4567-e89b-12d3-a456-426614174000';
    const sessionB = '323e4567-e89b-12d3-a456-426614174002';

    await upsertBindingForSession(sessionA, {
      deckId: '223e4567-e89b-12d3-a456-426614174001',
      deckName: 'Deck A',
      source: 'session_override',
      updatedAt: '2026-01-01T00:00:00.000Z',
      cardCounts: { mcp: 1, credentials: 0, playbooks: 0 },
    });

    expect(await readBindingForSession(sessionB)).toBeNull();
    expect((await readBindingForSession(sessionA))?.deckName).toBe('Deck A');
  });
});
