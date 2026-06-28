import { describe, it, expect } from 'vitest';
import { brandingDomainsFromUrl } from './icon-resolver';

describe('brandingDomainsFromUrl', () => {
  it('strips mcp/api prefixes and adds registrable domain', () => {
    expect(brandingDomainsFromUrl('https://mcp.notion.com/mcp')).toEqual(
      expect.arrayContaining(['mcp.notion.com', 'notion.com']),
    );
  });

  it('maps github copilot host to github.com', () => {
    expect(brandingDomainsFromUrl('https://api.githubcopilot.com/mcp/')).toContain('github.com');
  });

  it('returns empty for local MCP URLs', () => {
    expect(brandingDomainsFromUrl('local://Memory')).toEqual([]);
  });
});
