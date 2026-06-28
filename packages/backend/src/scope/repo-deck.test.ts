import { describe, it, expect } from 'vitest';
import { parseRepoDeckManifest, formatRepoDeckManifest } from '../scope/repo-deck';

describe('repo deck manifest', () => {
  it('parses deck_id and optional name', () => {
    const manifest = parseRepoDeckManifest(`
deck_id: 550e8400-e29b-41d4-a716-446655440000
name: Hiring stack
`);
    expect(manifest.deck_id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(manifest.name).toBe('Hiring stack');
  });

  it('formats a copy-paste snippet for repos', () => {
    const content = formatRepoDeckManifest(
      '550e8400-e29b-41d4-a716-446655440000',
      'Hiring stack',
    );
    expect(content).toContain('deck_id: 550e8400-e29b-41d4-a716-446655440000');
    expect(content).toContain('name: Hiring stack');
  });
});
