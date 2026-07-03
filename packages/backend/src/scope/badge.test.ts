import { describe, expect, it } from 'vitest';
import { assignBadge, BADGE_WORDS } from './badge';

describe('assignBadge', () => {
  it('picks the first unused word', () => {
    expect(assignBadge(new Set())).toBe(BADGE_WORDS[0]);
    expect(assignBadge(new Set([BADGE_WORDS[0]]))).toBe(BADGE_WORDS[1]);
  });

  it('never returns a used badge', () => {
    const used = new Set(BADGE_WORDS.slice(0, 5));
    expect(used.has(assignBadge(used))).toBe(false);
  });

  it('falls back to numbered badges on pool exhaustion', () => {
    const used = new Set(BADGE_WORDS);
    expect(assignBadge(used)).toBe('s1');
    used.add('s1');
    expect(assignBadge(used)).toBe('s2');
  });

  it('word list is unique and lowercase', () => {
    expect(new Set(BADGE_WORDS).size).toBe(BADGE_WORDS.length);
    for (const word of BADGE_WORDS) {
      expect(word).toBe(word.toLowerCase());
    }
  });
});
