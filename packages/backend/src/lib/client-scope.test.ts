import { describe, it, expect } from 'vitest';
import { applyDeckCredentialScope } from './client-scope';
import { Deck } from '@agent-deck/shared';

const baseDeck = (overrides: Partial<Deck>): Deck => ({
  id: 'deck-1',
  name: 'Test',
  isActive: false,
  services: [],
  credentials: [{ id: 'cred_a' } as Deck['credentials'][number]],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('applyDeckCredentialScope', () => {
  it('keeps credentials for dashboard clients', () => {
    const deck = baseDeck({ isActive: false });
    expect(applyDeckCredentialScope(deck, 'dashboard').credentials).toHaveLength(1);
  });

  it('keeps credentials only for the bound deck id for agent clients', () => {
    const bound = baseDeck({ id: 'deck-bound', isActive: false });
    const other = baseDeck({ id: 'deck-other', isActive: true });

    expect(applyDeckCredentialScope(bound, 'agent', 'deck-bound').credentials).toHaveLength(1);
    expect(applyDeckCredentialScope(other, 'agent', 'deck-bound').credentials).toHaveLength(0);
  });
});
