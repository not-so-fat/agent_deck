import { describe, expect, it } from 'vitest';

import {
  getOAuthProviderGuide,
  getSlackMcpAppManifest,
  inferOAuthProvider,
  resolveOAuthSetupMode,
} from './oauth-provider-guides';
import { hasSharedOAuthApp } from '../config/shared-oauth-apps';

describe('oauth-provider-guides', () => {
  it('marks figma as unavailable', () => {
    expect(resolveOAuthSetupMode('figma', false)).toBe('unavailable');
    expect(getOAuthProviderGuide('figma').unavailableReason).toContain('Figma');
  });

  it('marks google and slack as manual', () => {
    expect(resolveOAuthSetupMode('google', false)).toBe('manual');
    expect(resolveOAuthSetupMode('slack', false)).toBe('manual');
    expect(getOAuthProviderGuide('google').redirectUri).toBe('http://127.0.0.1:8000/api/oauth/callback');
    const slack = getOAuthProviderGuide('slack');
    expect(slack.manifestJson).toBeTruthy();
    expect(slack.createAppUrl).toContain('api.slack.com');
    const manifest = JSON.parse(getSlackMcpAppManifest());
    expect(manifest.oauth_config.redirect_urls[0]).toBe('http://127.0.0.1:8000/api/oauth/callback');
  });

  it('uses managed mode for slack when shared app env is set', () => {
    process.env.AGENT_DECK_SLACK_CLIENT_ID = 'id';
    process.env.AGENT_DECK_SLACK_CLIENT_SECRET = 'secret';
    expect(hasSharedOAuthApp('slack')).toBe(true);
    expect(resolveOAuthSetupMode('slack', false)).toBe('managed');
    expect(getOAuthProviderGuide('slack').setupMode).toBe('managed');
    delete process.env.AGENT_DECK_SLACK_CLIENT_ID;
    delete process.env.AGENT_DECK_SLACK_CLIENT_SECRET;
  });

  it('infers providers from MCP URLs', () => {
    expect(inferOAuthProvider('https://calendarmcp.googleapis.com/mcp/v1')).toBe('google');
    expect(inferOAuthProvider('https://mcp.slack.com/mcp')).toBe('slack');
    expect(inferOAuthProvider('https://mcp.figma.com/mcp')).toBe('figma');
  });
});
