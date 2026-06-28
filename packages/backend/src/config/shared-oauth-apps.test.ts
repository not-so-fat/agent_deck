import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getSharedOAuthCredentials,
  hasSharedOAuthApp,
} from './shared-oauth-apps';

describe('shared-oauth-apps', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.AGENT_DECK_SLACK_CLIENT_ID;
    delete process.env.AGENT_DECK_SLACK_CLIENT_SECRET;
  });

  afterEach(() => {
    process.env = env;
  });

  it('returns null when slack credentials are missing', () => {
    expect(getSharedOAuthCredentials('slack')).toBeNull();
    expect(hasSharedOAuthApp('slack')).toBe(false);
  });

  it('returns credentials when slack env vars are set', () => {
    process.env.AGENT_DECK_SLACK_CLIENT_ID = 'slack-client-id';
    process.env.AGENT_DECK_SLACK_CLIENT_SECRET = 'slack-client-secret';

    expect(hasSharedOAuthApp('slack')).toBe(true);
    expect(getSharedOAuthCredentials('slack')).toEqual({
      clientId: 'slack-client-id',
      clientSecret: 'slack-client-secret',
      operator: 'agent-deck',
    });
  });
});
