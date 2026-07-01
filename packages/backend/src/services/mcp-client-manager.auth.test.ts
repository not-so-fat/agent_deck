import { describe, expect, it } from 'vitest';
import type { Service } from '@agent-deck/shared';

import { MCPClientManager } from './mcp-client-manager';

describe('MCPClientManager auth headers', () => {
  it('preserves Authorization from service headers when OAuth token is absent', async () => {
    const manager = new MCPClientManager(async () => null);
    const buildHeaders = (manager as unknown as {
      buildRequestHeaders: (service: Service) => Promise<Record<string, string>>;
    }).buildRequestHeaders.bind(manager);

    const headers = await buildHeaders({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Docmost',
      type: 'mcp',
      url: 'https://docmost.example.com/mcp',
      health: 'unknown',
      cardColor: '#92E4DD',
      disabledToolNames: [],
      isConnected: false,
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      headers: { Authorization: 'Bearer docmost-jwt' },
    });

    expect(headers.Authorization).toBe('Bearer docmost-jwt');
  });
});
