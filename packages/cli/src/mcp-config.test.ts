import { describe, expect, it } from 'vitest';

import { buildAgentDeckEntry, mergeMcpServerConfig } from './mcp-config';
import { compareSemver } from './upgrade';

describe('mergeMcpServerConfig', () => {
  it('adds agent-deck without removing other servers', () => {
    const merged = mergeMcpServerConfig(
      {
        mcpServers: {
          memory: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] },
        },
      },
      { url: 'http://127.0.0.1:3001/mcp' },
    );

    expect(merged.mcpServers).toEqual({
      memory: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] },
      'agent-deck': { url: 'http://127.0.0.1:3001/mcp' },
    });
  });
});

describe('buildAgentDeckEntry', () => {
  it('uses http type for claude', () => {
    expect(buildAgentDeckEntry('claude', { host: '127.0.0.1', mcpPort: 3001 })).toEqual({
      type: 'http',
      url: 'http://127.0.0.1:3001/mcp',
    });
  });

  it('uses supergateway bridge for claude-desktop', () => {
    expect(buildAgentDeckEntry('claude-desktop', { host: '127.0.0.1', mcpPort: 3001 })).toEqual({
      command: 'npx',
      args: ['-y', 'supergateway', '--streamableHttp', 'http://127.0.0.1:3001/mcp'],
    });
  });
});

describe('compareSemver', () => {
  it('detects newer patch versions', () => {
    expect(compareSemver('1.1.1', '1.1.0')).toBeGreaterThan(0);
    expect(compareSemver('1.1.0', '1.1.1')).toBeLessThan(0);
    expect(compareSemver('1.1.0', '1.1.0')).toBe(0);
  });
});
