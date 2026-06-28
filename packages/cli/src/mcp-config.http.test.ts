import { describe, it, expect } from 'vitest';

import { buildAgentDeckEntry, buildMcpUrl } from './mcp-config';

describe('MCP client config', () => {
  it('uses http URL for Claude Code streamable HTTP', () => {
    expect(buildAgentDeckEntry('claude', { host: '127.0.0.1', mcpPort: 3001 })).toEqual({
      type: 'http',
      url: 'http://127.0.0.1:3001/mcp',
    });
  });

  it('uses bare url for Cursor', () => {
    expect(buildAgentDeckEntry('cursor', { host: '127.0.0.1', mcpPort: 3001 })).toEqual({
      url: 'http://127.0.0.1:3001/mcp',
    });
  });

  it('buildMcpUrl never uses https for local default host', () => {
    const url = buildMcpUrl({ host: '127.0.0.1', mcpPort: 3001 });
    expect(url).toBe('http://127.0.0.1:3001/mcp');
    expect(url.startsWith('https://')).toBe(false);
  });
});
