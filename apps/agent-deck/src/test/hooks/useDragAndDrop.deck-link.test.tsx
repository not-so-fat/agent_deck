import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDragAndDrop } from '@/hooks/use-drag-and-drop';
import { apiRequest } from '@/lib/queryClient';
import { createTestWrapper } from '../setup';

vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const DECK_ID = 'deck-edit-1';

const mockService = {
  id: 'svc-1',
  name: 'Linear',
  type: 'mcp' as const,
  url: 'https://mcp.linear.app/mcp',
  health: 'healthy' as const,
  cardColor: '#7ed4da',
  isConnected: true,
  registeredAt: '2026-07-03T00:00:00.000Z',
  updatedAt: '2026-07-03T00:00:00.000Z',
};

const mockCredential = {
  id: 'cred_ashby',
  label: 'Ashby',
  scheme: 'bearer' as const,
  envName: 'ASHBY_API_KEY',
  keychainAccount: 'cred_ashby',
  tags: [] as string[],
  hasSecret: true,
  createdAt: '2026-07-03T00:00:00.000Z',
  updatedAt: '2026-07-03T00:00:00.000Z',
};

const mockPlaybook = {
  id: 'pb_triage',
  title: 'Inbox triage',
  body: '# Steps',
  triggers: ['check inbox'],
  dependsOnCredentialIds: [] as string[],
  dependsOnServiceIds: [] as string[],
  createdAt: '2026-07-03T00:00:00.000Z',
  updatedAt: '2026-07-03T00:00:00.000Z',
};

function jsonResponse(data: unknown) {
  return {
    json: async () => data,
  } as Response;
}

function dropEvent(payload: { kind: string; id: string; fromDeck: boolean }) {
  return {
    preventDefault: vi.fn(),
    dataTransfer: {
      getData: (type: string) =>
        type === 'application/json' ? JSON.stringify(payload) : payload.id,
    },
  } as unknown as React.DragEvent;
}

describe('S11: dashboard deck link/unlink (useDragAndDrop)', () => {
  const api = vi.mocked(apiRequest);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('links a service from collection onto the editing deck', async () => {
    api.mockImplementation(async (method, url) => {
      if (method === 'GET' && url === '/api/decks') {
        return jsonResponse({
          data: [{ id: DECK_ID, name: 'dev', services: [], credentials: [], playbooks: [] }],
        });
      }
      if (method === 'POST' && url === `/api/decks/${DECK_ID}/services`) {
        return jsonResponse({ success: true });
      }
      throw new Error(`unexpected ${method} ${url}`);
    });

    const { result } = renderHook(() => useDragAndDrop(DECK_ID), {
      wrapper: createTestWrapper(),
    });

    await act(async () => {
      result.current.handleDrop(
        dropEvent({ kind: 'service', id: mockService.id, fromDeck: false }),
      );
    });

    await waitFor(() => {
      expect(api).toHaveBeenCalledWith('POST', `/api/decks/${DECK_ID}/services`, {
        serviceId: mockService.id,
        position: 0,
      });
    });
  });

  it('unlinks a service from the editing deck', async () => {
    api.mockImplementation(async (method, url) => {
      if (method === 'GET' && String(url).includes('/api/playbooks/dependents/check')) {
        return jsonResponse({ data: [] });
      }
      if (method === 'DELETE' && url === `/api/decks/${DECK_ID}/services`) {
        return jsonResponse({ success: true });
      }
      throw new Error(`unexpected ${method} ${url}`);
    });

    const { result } = renderHook(() => useDragAndDrop(DECK_ID), {
      wrapper: createTestWrapper(),
    });

    await act(async () => {
      result.current.handleDrop(
        dropEvent({ kind: 'service', id: mockService.id, fromDeck: true }),
      );
    });

    await waitFor(() => {
      expect(api).toHaveBeenCalledWith('DELETE', `/api/decks/${DECK_ID}/services`, {
        serviceId: mockService.id,
      });
    });
  });

  it('links and unlinks a credential', async () => {
    api.mockImplementation(async (method, url) => {
      if (method === 'GET' && url === '/api/decks') {
        return jsonResponse({
          data: [{ id: DECK_ID, credentials: [], services: [], playbooks: [] }],
        });
      }
      if (method === 'GET' && String(url).includes('/api/playbooks/dependents/check')) {
        return jsonResponse({ data: [] });
      }
      if (method === 'POST' && url === `/api/decks/${DECK_ID}/credentials`) {
        return jsonResponse({ success: true });
      }
      if (method === 'DELETE' && url === `/api/decks/${DECK_ID}/credentials`) {
        return jsonResponse({ success: true });
      }
      throw new Error(`unexpected ${method} ${url}`);
    });

    const { result } = renderHook(() => useDragAndDrop(DECK_ID), {
      wrapper: createTestWrapper(),
    });

    await act(async () => {
      result.current.handleDrop(
        dropEvent({ kind: 'credential', id: mockCredential.id, fromDeck: false }),
      );
    });
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith('POST', `/api/decks/${DECK_ID}/credentials`, {
        credentialId: mockCredential.id,
      });
    });

    await act(async () => {
      result.current.handleDrop(
        dropEvent({ kind: 'credential', id: mockCredential.id, fromDeck: true }),
      );
    });
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith('DELETE', `/api/decks/${DECK_ID}/credentials`, {
        credentialId: mockCredential.id,
      });
    });
  });

  it('links and unlinks a playbook', async () => {
    api.mockImplementation(async (method, url) => {
      if (method === 'GET' && url === '/api/decks') {
        return jsonResponse({
          data: [{ id: DECK_ID, playbooks: [], services: [], credentials: [] }],
        });
      }
      if (method === 'POST' && url === `/api/decks/${DECK_ID}/playbooks`) {
        return jsonResponse({ success: true });
      }
      if (method === 'DELETE' && url === `/api/decks/${DECK_ID}/playbooks`) {
        return jsonResponse({ success: true });
      }
      throw new Error(`unexpected ${method} ${url}`);
    });

    const { result } = renderHook(() => useDragAndDrop(DECK_ID), {
      wrapper: createTestWrapper(),
    });

    await act(async () => {
      result.current.handleDrop(
        dropEvent({ kind: 'playbook', id: mockPlaybook.id, fromDeck: false }),
      );
    });
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith('POST', `/api/decks/${DECK_ID}/playbooks`, {
        playbookId: mockPlaybook.id,
      });
    });

    await act(async () => {
      result.current.handleDrop(
        dropEvent({ kind: 'playbook', id: mockPlaybook.id, fromDeck: true }),
      );
    });
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith('DELETE', `/api/decks/${DECK_ID}/playbooks`, {
        playbookId: mockPlaybook.id,
      });
    });
  });

  it('global drop only removes cards dragged from the deck', async () => {
    api.mockImplementation(async (method, url) => {
      if (method === 'GET' && String(url).includes('/api/playbooks/dependents/check')) {
        return jsonResponse({ data: [] });
      }
      if (method === 'DELETE' && url === `/api/decks/${DECK_ID}/services`) {
        return jsonResponse({ success: true });
      }
      throw new Error(`unexpected ${method} ${url}`);
    });

    const { result } = renderHook(() => useDragAndDrop(DECK_ID), {
      wrapper: createTestWrapper(),
    });

    await act(async () => {
      result.current.handleGlobalDrop(
        dropEvent({ kind: 'service', id: mockService.id, fromDeck: false }),
      );
    });
    expect(api).not.toHaveBeenCalled();

    await act(async () => {
      result.current.handleGlobalDrop(
        dropEvent({ kind: 'service', id: mockService.id, fromDeck: true }),
      );
    });
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith('DELETE', `/api/decks/${DECK_ID}/services`, {
        serviceId: mockService.id,
      });
    });
  });

  it('cancels unlink when playbook dependents exist and user declines', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    api.mockImplementation(async (method, url) => {
      if (method === 'GET' && String(url).includes('/api/playbooks/dependents/check')) {
        return jsonResponse({ data: [{ id: 'pb_x', title: 'Depends' }] });
      }
      throw new Error(`unexpected ${method} ${url}`);
    });

    const { result } = renderHook(() => useDragAndDrop(DECK_ID), {
      wrapper: createTestWrapper(),
    });

    await act(async () => {
      result.current.handleDrop(
        dropEvent({ kind: 'service', id: mockService.id, fromDeck: true }),
      );
    });

    await waitFor(() => {
      expect(api).toHaveBeenCalledWith(
        'GET',
        expect.stringContaining('/api/playbooks/dependents/check'),
      );
    });
    expect(api).not.toHaveBeenCalledWith(
      'DELETE',
      `/api/decks/${DECK_ID}/services`,
      expect.anything(),
    );
  });
});
