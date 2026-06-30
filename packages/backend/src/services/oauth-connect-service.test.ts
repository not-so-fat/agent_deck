import { describe, expect, it } from 'vitest';

import {
  hasSavedOAuthCredentials,
  resolveOAuthClientCredentials,
} from './oauth-connect-service';

describe('resolveOAuthClientCredentials', () => {
  it('reuses stored secret when reconnect field is left blank', () => {
    const resolved = resolveOAuthClientCredentials(
      { clientId: 'saved-id', clientSecret: '' },
      { oauthClientId: 'saved-id', oauthClientSecret: 'stored-secret' },
    );

    expect(resolved.clientId).toBe('saved-id');
    expect(resolved.clientSecret).toBe('stored-secret');
    expect(resolved.missingRequiredSecret).toBe(false);
  });

  it('prefers a newly entered secret over the stored value', () => {
    const resolved = resolveOAuthClientCredentials(
      { clientId: 'saved-id', clientSecret: 'new-secret' },
      { oauthClientId: 'saved-id', oauthClientSecret: 'stored-secret' },
    );

    expect(resolved.clientSecret).toBe('new-secret');
  });

  it('flags missing secret when manual connect has no stored secret', () => {
    const resolved = resolveOAuthClientCredentials(
      { clientId: 'slack-id', clientSecret: '' },
      { oauthClientId: null, oauthClientSecret: null },
    );

    expect(resolved.missingRequiredSecret).toBe(true);
  });
});

describe('hasSavedOAuthCredentials', () => {
  it('is true only when both id and secret are stored', () => {
    expect(
      hasSavedOAuthCredentials({
        oauthClientId: 'id',
        oauthClientSecret: 'secret',
      }),
    ).toBe(true);
    expect(
      hasSavedOAuthCredentials({
        oauthClientId: 'id',
        oauthClientSecret: '',
      }),
    ).toBe(false);
  });
});
