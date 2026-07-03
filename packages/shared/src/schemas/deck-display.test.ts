import { describe, expect, it } from 'vitest';
import path from 'node:path';
import {
  BindingsFileSchema,
  DISPLAY_LINE_MAX_LENGTH,
  DeckDisplaySchema,
  countDeckCards,
  formatDisplayLine,
  formatDisplayUpdatedSuffix,
  isBindingSidecarSessionKey,
  lookupWorkspaceBinding,
  resolveBindingEntry,
  resolveStatusLineSessionId,
  resolveStatusLineWorkspace,
} from './deck-display';

describe('deck-display', () => {
  describe('countDeckCards', () => {
    it('counts mcp services separately from other service types', () => {
      expect(
        countDeckCards({
          services: [{ type: 'mcp' }, { type: 'mcp' }, { type: 'api' }],
          credentials: [{ id: '1' }],
          playbooks: [],
        }),
      ).toEqual({ mcp: 2, credentials: 1, playbooks: 0 });
    });
  });

  describe('formatDisplayLine', () => {
    const counts = { mcp: 3, credentials: 2, playbooks: 1 };

    it('renders bound deck summary', () => {
      expect(formatDisplayLine('Dev Deck', counts)).toBe(
        '◆ Dev Deck · 3 MCP · 2 keys · 1 playbooks',
      );
    });

    it('renders unbound placeholder', () => {
      expect(formatDisplayLine(null, counts)).toBe('◆ —');
    });

    it('renders offline message', () => {
      expect(formatDisplayLine('Dev Deck', counts, { offline: true })).toBe(
        '◆ Agent Deck offline',
      );
    });

    it('appends updated timestamp suffix', () => {
      const suffix = formatDisplayUpdatedSuffix('2026-07-02T07:20:00.000Z');
      expect(suffix).toMatch(/\(updated 2026-07-02 \d{2}:20\)/);
      expect(formatDisplayLine('Dev Deck', counts, { updatedAt: '2026-07-02T07:20:00.000Z' })).toContain(
        '(updated',
      );
    });

    it('truncates long deck names within max length', () => {
      const line = formatDisplayLine('A'.repeat(200), counts);
      expect(line.length).toBeLessThanOrEqual(DISPLAY_LINE_MAX_LENGTH);
      expect(line.endsWith('playbooks')).toBe(true);
    });
  });

  describe('resolveStatusLineSessionId', () => {
    it('reads session_id from stdin payload', () => {
      expect(
        resolveStatusLineSessionId({
          session_id: '123e4567-e89b-12d3-a456-426614174000',
        }),
      ).toBe('123e4567-e89b-12d3-a456-426614174000');
    });
  });

  describe('resolveStatusLineWorkspace', () => {
    it('prefers workspace.project_dir over cwd', () => {
      expect(
        resolveStatusLineWorkspace({
          cwd: '/repo/packages/app',
          workspace: { project_dir: '/repo', current_dir: '/repo/packages/app' },
        }),
      ).toBe(path.resolve('/repo'));
    });

    it('prefers cwd over workspace.current_dir when project_dir absent', () => {
      expect(
        resolveStatusLineWorkspace({
          cwd: '/repo',
          workspace: { current_dir: '/other' },
        }),
      ).toBe(path.resolve('/repo'));
    });

    it('falls back to workspace.current_dir', () => {
      expect(resolveStatusLineWorkspace({ workspace: { current_dir: '/repo' } })).toBe(
        path.resolve('/repo'),
      );
    });
  });

  describe('resolveBindingEntry', () => {
    const bindings = {
      '123e4567-e89b-12d3-a456-426614174000': {
        deckId: '223e4567-e89b-12d3-a456-426614174001',
        deckName: 'MCP Session Deck',
        source: 'session_override' as const,
        updatedAt: '2026-01-01T00:00:00.000Z',
        cardCounts: { mcp: 1, credentials: 0, playbooks: 0 },
      },
      [path.resolve('/repo')]: {
        deckId: '323e4567-e89b-12d3-a456-426614174002',
        deckName: 'Workspace Deck',
        source: 'session_override' as const,
        updatedAt: '2026-07-02T15:33:00.000Z',
        cardCounts: { mcp: 4, credentials: 0, playbooks: 4 },
      },
    };

    it('prefers workspace key over MCP session UUID keys', () => {
      expect(
        resolveBindingEntry(bindings, {
          sessionId: '123e4567-e89b-12d3-a456-426614174000',
          workspaceRoot: '/repo',
        })?.deckName,
      ).toBe('Workspace Deck');
    });

    it('ignores host session_id when workspace sidecar is absent', () => {
      expect(
        resolveBindingEntry(bindings, {
          sessionId: '123e4567-e89b-12d3-a456-426614174000',
          workspaceRoot: '/other',
        }),
      ).toBeNull();
    });
  });

  describe('isBindingSidecarSessionKey', () => {
    it('detects UUID session keys', () => {
      expect(isBindingSidecarSessionKey('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isBindingSidecarSessionKey('/Users/me/repo')).toBe(false);
    });
  });

  describe('lookupWorkspaceBinding', () => {
    it('walks up to parent workspace keys', () => {
      const bindings = {
        [path.resolve('/repo')]: {
          deckId: '123e4567-e89b-12d3-a456-426614174000',
          deckName: 'Dev',
          source: 'session_override' as const,
          updatedAt: '2026-01-01T00:00:00.000Z',
          cardCounts: { mcp: 1, credentials: 0, playbooks: 0 },
        },
      };
      expect(lookupWorkspaceBinding(bindings, '/repo/packages/app')).toEqual(
        bindings[path.resolve('/repo')],
      );
    });
  });

  describe('schemas', () => {
    it('validates bindings file entries', () => {
      const result = BindingsFileSchema.safeParse({
        '123e4567-e89b-12d3-a456-426614174000': {
          deckId: '223e4567-e89b-12d3-a456-426614174001',
          deckName: 'Dev',
          source: 'session_override',
          updatedAt: '2026-01-01T00:00:00.000Z',
          cardCounts: { mcp: 1, credentials: 0, playbooks: 0 },
        },
      });
      expect(result.success).toBe(true);
    });

    it('validates deck display payload', () => {
      const result = DeckDisplaySchema.safeParse({
        workspaceRoot: '/Users/me/repo',
        deckId: '123e4567-e89b-12d3-a456-426614174000',
        deckName: 'Dev',
        source: 'repo_manifest',
        cardCounts: { mcp: 1, credentials: 0, playbooks: 0 },
        agentDeckOnline: true,
        displayLine: '◆ Dev · 1 MCP · 0 keys · 0 playbooks',
      });
      expect(result.success).toBe(true);
    });
  });
});
