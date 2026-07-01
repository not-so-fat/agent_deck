import { describe, expect, it } from 'vitest';
import { buildCredentialAuthHeaders } from './credential-auth-headers';

describe('buildCredentialAuthHeaders', () => {
  it('maps bearer credentials to Authorization header', () => {
    expect(buildCredentialAuthHeaders({ scheme: 'bearer' }, 'jwt-token')).toEqual({
      Authorization: 'Bearer jwt-token',
    });
  });

  it('maps header scheme to custom header name', () => {
    expect(
      buildCredentialAuthHeaders({ scheme: 'header', headerName: 'X-API-Key' }, 'secret'),
    ).toEqual({
      'X-API-Key': 'secret',
    });
  });
});
