import type { Service } from '../schemas/service';
import { isOAuthTokenExpiringSoon } from './collection-warnings';

type OAuthSessionFields = Pick<
  Service,
  'oauthAccessToken' | 'oauthTokenExpiresAt'
>;

/** True when the service has a usable OAuth access token for MCP calls. */
export function isOAuthSessionValid(service: OAuthSessionFields): boolean {
  if (!service.oauthAccessToken) {
    return false;
  }
  return !isOAuthTokenExpiringSoon(service.oauthTokenExpiresAt);
}

/** Backend: token is expired only when we have an expiry time in the past. */
export function isOAuthAccessTokenExpired(
  service: OAuthSessionFields,
  bufferMs = 5 * 60 * 1000,
): boolean {
  if (!service.oauthAccessToken) {
    return true;
  }
  if (!service.oauthTokenExpiresAt) {
    return false;
  }
  return new Date(service.oauthTokenExpiresAt).getTime() <= Date.now() + bufferMs;
}
