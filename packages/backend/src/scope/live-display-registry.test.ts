import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LiveDisplayRegistry } from './live-display-registry';

describe('LiveDisplayRegistry', () => {
  it('finds the newest bind for an exact workspace', () => {
    const registry = new LiveDisplayRegistry();
    const workspace = path.resolve('/repo');

    registry.upsert({
      mcpSessionId: 'older',
      workspaceRoot: workspace,
      deckId: '11111111-1111-4111-8111-111111111111',
      deckName: 'Older',
      source: 'session_override',
      cardCounts: { mcp: 1, credentials: 0, playbooks: 0 },
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    registry.upsert({
      mcpSessionId: 'newer',
      workspaceRoot: workspace,
      deckId: '22222222-2222-4222-8222-222222222222',
      deckName: 'Newer',
      source: 'session_override',
      cardCounts: { mcp: 2, credentials: 0, playbooks: 0 },
      updatedAt: '2026-07-02T15:33:00.000Z',
    });

    expect(registry.findForWorkspace(workspace)?.deckName).toBe('Newer');
  });

  it('walks up to parent workspace binds', () => {
    const registry = new LiveDisplayRegistry();
    const workspace = path.resolve('/repo');

    registry.upsert({
      mcpSessionId: 'session-1',
      workspaceRoot: workspace,
      deckId: '11111111-1111-4111-8111-111111111111',
      deckName: 'Root Deck',
      source: 'repo_manifest',
      cardCounts: { mcp: 1, credentials: 0, playbooks: 0 },
      updatedAt: '2026-07-02T15:33:00.000Z',
    });

    expect(registry.findForWorkspace(path.join(workspace, 'packages', 'app'))?.deckName).toBe(
      'Root Deck',
    );
  });

  it('removes entries when MCP session closes', () => {
    const registry = new LiveDisplayRegistry();
    const workspace = path.resolve('/repo');

    registry.upsert({
      mcpSessionId: 'session-1',
      workspaceRoot: workspace,
      deckId: '11111111-1111-4111-8111-111111111111',
      deckName: 'Root Deck',
      source: 'repo_manifest',
      cardCounts: { mcp: 1, credentials: 0, playbooks: 0 },
      updatedAt: '2026-07-02T15:33:00.000Z',
    });
    registry.remove('session-1');

    expect(registry.findForWorkspace(workspace)).toBeNull();
  });
});
