import { describe, expect, it } from 'vitest';
import {
  countSessionsByDeckId,
  formatActivityAge,
  formatDeckListSubtitle,
  truncateDeckName,
  workspaceBasename,
} from './live-bindings';

const NOW = new Date('2026-07-03T12:00:00.000Z');

describe('live-bindings helpers', () => {
  it('formatActivityAge matches menubar units', () => {
    expect(formatActivityAge('2026-07-03T11:59:48.000Z', NOW)).toBe('12s');
    expect(formatActivityAge('2026-07-03T11:58:00.000Z', NOW)).toBe('2m');
    expect(formatActivityAge('not-a-date', NOW)).toBe('');
  });

  it('truncateDeckName caps at 24 chars', () => {
    expect(truncateDeckName('Product Design')).toBe('Product Design');
    expect(truncateDeckName('A Very Long Deck Name That Overflows')).toHaveLength(24);
  });

  it('workspaceBasename takes the last path segment', () => {
    expect(workspaceBasename('/Users/me/workspace/agent_deck')).toBe('agent_deck');
  });

  it('countSessionsByDeckId groups live binds', () => {
    const counts = countSessionsByDeckId([
      { deckId: 'a' },
      { deckId: 'a' },
      { deckId: 'b' },
    ]);
    expect(counts.get('a')).toBe(2);
    expect(counts.get('b')).toBe(1);
  });

  it('formatDeckListSubtitle shows cards and sessions', () => {
    expect(formatDeckListSubtitle(17, 2)).toBe('17 cards, 2 sessions');
    expect(formatDeckListSubtitle(17, 1)).toBe('17 cards, 1 session');
    expect(formatDeckListSubtitle(17, 0)).toBe('17 cards');
    expect(formatDeckListSubtitle(0, 0)).toBe('Empty');
  });
});
