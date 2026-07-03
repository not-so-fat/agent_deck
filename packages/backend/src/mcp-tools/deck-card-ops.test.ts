import { describe, expect, it, vi } from 'vitest';
import { executeListCollection, executeManageDeckCard } from './deck-card-ops';

describe('executeManageDeckCard', () => {
  const deckId = '11111111-1111-4111-8111-111111111111';

  function backend() {
    return {
      getBoundDeckId: vi.fn(async () => deckId),
      callBackendAPI: vi.fn(async () => ({})),
    };
  }

  it('links a service on the bound deck', async () => {
    const api = backend();
    const result = await executeManageDeckCard(api, {
      action: 'link',
      card_type: 'service',
      card_id: 'svc-1',
      position: 2,
    });
    expect(api.callBackendAPI).toHaveBeenCalledWith(
      `/api/decks/${deckId}/services`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ serviceId: 'svc-1', position: 2 }),
      }),
    );
    expect(result).toMatchObject({ success: true, action: 'link', card_type: 'service' });
  });

  it('unlinks a credential from the bound deck', async () => {
    const api = backend();
    await executeManageDeckCard(api, {
      action: 'unlink',
      card_type: 'credential',
      card_id: 'cred-1',
    });
    expect(api.callBackendAPI).toHaveBeenCalledWith(
      `/api/decks/${deckId}/credentials`,
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ credentialId: 'cred-1' }),
      }),
    );
  });

  it('reorders services when ordered_card_ids provided', async () => {
    const api = backend();
    await executeManageDeckCard(api, {
      action: 'reorder',
      card_type: 'service',
      ordered_card_ids: ['a', 'b'],
    });
    expect(api.callBackendAPI).toHaveBeenCalledWith(
      `/api/decks/${deckId}/services/reorder`,
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ serviceIds: ['a', 'b'] }),
      }),
    );
  });
});

describe('executeListCollection', () => {
  it('fetches all collection segments when unfiltered', async () => {
    const callBackendAPI = vi.fn(async (path: string) => ({ path }));
    const result = await executeListCollection({ getBoundDeckId: async () => 'd', callBackendAPI }, {});
    expect(callBackendAPI).toHaveBeenCalledTimes(3);
    expect(result).toHaveProperty('services');
    expect(result).toHaveProperty('credentials');
    expect(result).toHaveProperty('playbooks');
  });

  it('filters by card_type', async () => {
    const callBackendAPI = vi.fn(async () => []);
    await executeListCollection(
      { getBoundDeckId: async () => 'd', callBackendAPI },
      { card_type: 'playbook' },
    );
    expect(callBackendAPI).toHaveBeenCalledWith('/api/playbooks/collection');
    expect(callBackendAPI).toHaveBeenCalledTimes(1);
  });
});
