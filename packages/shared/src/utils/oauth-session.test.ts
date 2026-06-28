import { describe, expect, it } from 'vitest';

import {
  isOAuthAccessTokenExpired,
  isOAuthSessionValid,
} from './oauth-session';

describe('oauth-session', () => {
  it('treats token without expiry as valid and not expired', () => {
    const session = { oauthAccessToken: 'linear-token' };

    expect(isOAuthSessionValid(session)).toBe(true);
    expect(isOAuthAccessTokenExpired(session)).toBe(false);
  });

  it('flags expired tokens when expiry is in the past', () => {
    const session = {
      oauthAccessToken: 'expired-token',
      oauthTokenExpiresAt: '2020-01-01T00:00:00.000Z',
    };

    expect(isOAuthSessionValid(session)).toBe(false);
    expect(isOAuthAccessTokenExpired(session)).toBe(true);
  });

  it('requires an access token', () => {
    expect(isOAuthSessionValid({})).toBe(false);
    expect(isOAuthAccessTokenExpired({})).toBe(true);
  });
});
