import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readBindingForWorkspace, upsertWorkspaceDisplayBinding } from './bindings-sidecar';

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

  it('upserts workspace-keyed bindings for status line', async () => {
    const workspace = '/Users/me/repo';
    await upsertWorkspaceDisplayBinding(workspace, {
      deckId: '223e4567-e89b-12d3-a456-426614174001',
      deckName: 'Dev Deck',
      source: 'session_override',
      updatedAt: '2026-01-01T00:00:00.000Z',
      cardCounts: { mcp: 2, credentials: 1, playbooks: 0 },
      workspaceRoot: workspace,
    });

    const entry = await readBindingForWorkspace(workspace);
    expect(entry?.deckName).toBe('Dev Deck');
    expect(entry?.source).toBe('session_override');
  });

  it('prunes legacy MCP session UUID keys on write', async () => {
    const workspace = '/Users/me/repo';
    const bindingsPath = path.join(tempDir, 'bindings.json');
    await fs.writeFile(
      bindingsPath,
      JSON.stringify({
        '123e4567-e89b-12d3-a456-426614174000': {
          deckId: '223e4567-e89b-12d3-a456-426614174001',
          deckName: 'Stale Session Deck',
          source: 'session_override',
          updatedAt: '2026-01-01T00:00:00.000Z',
          cardCounts: { mcp: 1, credentials: 0, playbooks: 0 },
        },
      }),
      'utf8',
    );

    await upsertWorkspaceDisplayBinding(workspace, {
      deckId: '323e4567-e89b-12d3-a456-426614174002',
      deckName: 'Workspace Deck',
      source: 'session_override',
      updatedAt: '2026-07-02T15:33:00.000Z',
      cardCounts: { mcp: 4, credentials: 0, playbooks: 4 },
      workspaceRoot: workspace,
    });

    const raw = JSON.parse(await fs.readFile(bindingsPath, 'utf8')) as Record<string, unknown>;
    expect(raw['123e4567-e89b-12d3-a456-426614174000']).toBeUndefined();
    expect((raw[workspace] as { deckName: string }).deckName).toBe('Workspace Deck');
  });
});
