import { describe, expect, it } from 'vitest';

import { parseOAuthTokenResponse } from './oauth-token-response';

function mockResponse(body: string, contentType?: string): Response {
  return {
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType ?? null : null),
    },
    text: async () => body,
  } as Response;
}

describe('parseOAuthTokenResponse', () => {
  it('parses GitHub-style form-urlencoded token response', async () => {
    const data = await parseOAuthTokenResponse(
      mockResponse(
        'access_token=gho_abc123&scope=repo&token_type=bearer',
        'application/x-www-form-urlencoded; charset=utf-8',
      ),
    );

    expect(data.access_token).toBe('gho_abc123');
    expect(data.scope).toBe('repo');
    expect(data.token_type).toBe('bearer');
  });

  it('parses JSON token response', async () => {
    const data = await parseOAuthTokenResponse(
      mockResponse(
        JSON.stringify({
          access_token: 'tok',
          refresh_token: 'ref',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
        'application/json',
      ),
    );

    expect(data.access_token).toBe('tok');
    expect(data.refresh_token).toBe('ref');
    expect(data.expires_in).toBe(3600);
  });

  it('throws on form-urlencoded OAuth error', async () => {
    await expect(
      parseOAuthTokenResponse(
        mockResponse('error=bad_verification_code&error_description=The+code+passed+is+incorrect'),
      ),
    ).rejects.toThrow(/bad_verification_code/);
  });
});
