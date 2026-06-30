import type { Service } from '../schemas/service';
import { isOAuthTokenExpiringSoon } from './collection-warnings';

type OAuthSessionFields = Pick<
  Service,
  'oauthAccessToken' | 'oauthTokenExpiresAt' | 'oauthHasToken'
>;

export function serviceHasOAuthToken(service: OAuthSessionFields): boolean {
  return Boolean(service.oauthHasToken || service.oauthAccessToken);
}

/** True when the service has a usable OAuth access token for MCP calls. */
export function isOAuthSessionValid(service: OAuthSessionFields): boolean {
  if (!serviceHasOAuthToken(service)) {
    return false;
  }
  return !isOAuthTokenExpiringSoon(service.oauthTokenExpiresAt);
}

/** Backend: token is expired only when we have an expiry time in the past. */
export function isOAuthAccessTokenExpired(
  service: OAuthSessionFields,
  bufferMs = 5 * 60 * 1000,
): boolean {
  if (!serviceHasOAuthToken(service)) {
    return true;
  }
  if (!service.oauthTokenExpiresAt) {
    return false;
  }
  return new Date(service.oauthTokenExpiresAt).getTime() <= Date.now() + bufferMs;
}
