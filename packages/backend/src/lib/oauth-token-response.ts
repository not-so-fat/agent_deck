export type OAuthTokenResponseBody = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

/** Parse OAuth token endpoint body (JSON or application/x-www-form-urlencoded). */
export async function parseOAuthTokenResponse(response: Response): Promise<OAuthTokenResponseBody> {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error('OAuth token response was empty');
  }

  if (contentType.includes('application/json') || trimmed.startsWith('{')) {
    const data = JSON.parse(trimmed) as OAuthTokenResponseBody & { error?: string; error_description?: string };
    if (data.error) {
      throw new Error(
        `OAuth token error: ${data.error}${data.error_description ? ` — ${data.error_description}` : ''}`,
      );
    }
    if (!data.access_token) {
      throw new Error('OAuth token JSON response missing access_token');
    }
    return data;
  }

  const params = new URLSearchParams(trimmed);
  const oauthError = params.get('error');
  if (oauthError) {
    const description = params.get('error_description');
    throw new Error(`OAuth token error: ${oauthError}${description ? ` — ${description}` : ''}`);
  }

  const accessToken = params.get('access_token');
  if (!accessToken) {
    throw new Error(`OAuth token response missing access_token: ${trimmed.slice(0, 200)}`);
  }

  const expiresIn = params.get('expires_in');
  return {
    access_token: accessToken,
    refresh_token: params.get('refresh_token') ?? undefined,
    expires_in: expiresIn ? Number(expiresIn) : undefined,
    token_type: params.get('token_type') ?? undefined,
    scope: params.get('scope') ?? undefined,
  };
}

export function oauthTokenRequestHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };
}
