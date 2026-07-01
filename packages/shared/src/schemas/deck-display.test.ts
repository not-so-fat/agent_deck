import { describe, expect, it } from 'vitest';
import {
  BindingsFileSchema,
  DISPLAY_LINE_MAX_LENGTH,
  DeckDisplaySchema,
  countDeckCards,
  formatDisplayLine,
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

    it('truncates long deck names within max length', () => {
      const line = formatDisplayLine('A'.repeat(200), counts);
      expect(line.length).toBeLessThanOrEqual(DISPLAY_LINE_MAX_LENGTH);
      expect(line.endsWith('playbooks')).toBe(true);
    });
  });

  describe('resolveStatusLineWorkspace', () => {
    it('prefers cwd over workspace.current_dir', () => {
      expect(
        resolveStatusLineWorkspace({
          cwd: '/repo',
          workspace: { current_dir: '/other' },
        }),
      ).toBe('/repo');
    });

    it('falls back to workspace.current_dir', () => {
      expect(resolveStatusLineWorkspace({ workspace: { current_dir: '/repo' } })).toBe('/repo');
    });
  });

  describe('schemas', () => {
    it('validates bindings file entries', () => {
      const result = BindingsFileSchema.safeParse({
        '/Users/me/repo': {
          deckId: '123e4567-e89b-12d3-a456-426614174000',
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
