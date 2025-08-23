export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  redirectUri: string;
  scope: string;
}

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  tokenType: string;
  scope?: string;
}

export interface OAuthDiscoveryResult {
  hasOAuth: boolean;
  config?: OAuthConfig;
  error?: string;
}

export interface OAuthFlowInput {
  serviceId: string;
  redirectUri: string;
}

export interface OAuthCallbackInput {
  serviceId: string;
  code: string;
  state: string;
}

export interface OAuthRefreshInput {
  serviceId: string;
  refreshToken: string;
}
