import { describe, it, expect } from 'vitest';
import {
  normalizeLocalMcpManifestInput,
  parseLocalMcpManifestJson,
  stripJsonMarkdownFences,
} from './local-mcp-manifest';

describe('local-mcp-manifest', () => {
  const googleDriveServer = {
    command: 'npx',
    args: ['-y', '@piotr-agier/google-drive-mcp'],
    env: {
      GOOGLE_DRIVE_OAUTH_CREDENTIALS: '/tmp/gcp-oauth.keys.json',
    },
  };

  it('accepts standard mcpServers manifest', () => {
    const manifest = normalizeLocalMcpManifestInput({
      mcpServers: {
        'google-drive': googleDriveServer,
      },
    });
    expect(manifest.mcpServers['google-drive']).toEqual(googleDriveServer);
  });

  it('accepts unwrapped server map (common README copy)', () => {
    const manifest = normalizeLocalMcpManifestInput({
      'google-drive': googleDriveServer,
    });
    expect(manifest.mcpServers['google-drive']).toEqual(googleDriveServer);
  });

  it('accepts bare server config with optional name', () => {
    const manifest = normalizeLocalMcpManifestInput({
      name: 'google-drive',
      ...googleDriveServer,
    });
    expect(manifest.mcpServers['google-drive']).toEqual(googleDriveServer);
  });

  it('accepts config wrapper used by API import', () => {
    const manifest = normalizeLocalMcpManifestInput({
      config: {
        mcpServers: {
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
          },
        },
      },
    });
    expect(manifest.mcpServers.memory.command).toBe('npx');
  });

  it('strips markdown fences before parsing', () => {
    const raw = '```json\n' + JSON.stringify({ mcpServers: { drive: googleDriveServer } }, null, 2) + '\n```';
    expect(stripJsonMarkdownFences(raw)).not.toContain('```');
    const manifest = parseLocalMcpManifestJson(raw);
    expect(manifest.mcpServers.drive.command).toBe('npx');
  });

  it('throws a helpful error for remote-only MCP entries', () => {
    expect(() =>
      normalizeLocalMcpManifestInput({
        mcpServers: {
          'agent-deck': { url: 'http://127.0.0.1:11112/mcp' },
        },
      })
    ).toThrow(/expected a top-level "mcpServers"/);
  });
});
