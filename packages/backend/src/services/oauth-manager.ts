import { 
  OAuthDiscoveryResult, 
  OAuthConfig, 
  OAuthToken,
  OAuthFlowInput,
  OAuthCallbackInput,
  OAuthRefreshInput
} from '@agent-deck/shared';
import { DatabaseManager } from '../models/database';
import { randomBytes } from 'crypto';

interface OAuthMetadata {
  authorization_endpoint?: string;
  token_endpoint?: string;
  scopes_supported?: string[];
  authorizationUrl?: string;
  tokenUrl?: string;
  scope?: string;
}

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

export class OAuthManager {
  constructor(private db: DatabaseManager) {}

  async discoverOAuth(serviceUrl: string): Promise<OAuthDiscoveryResult> {
    try {
      // Try to get OAuth metadata from the service
      const response = await fetch(`${serviceUrl}/.well-known/oauth-authorization-server`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const metadata = await response.json() as OAuthMetadata;
        
        const config: OAuthConfig = {
          clientId: '', // Will be provided by user
          clientSecret: '', // Will be provided by user
          authorizationUrl: metadata.authorization_endpoint || '',
          tokenUrl: metadata.token_endpoint || '',
          redirectUri: '', // Will be set during OAuth flow
          scope: metadata.scopes_supported?.[0] || 'read write',
        };

        return {
          hasOAuth: true,
          config,
        };
      }

      // Try alternative discovery methods
      const alternativeResponse = await fetch(`${serviceUrl}/oauth/metadata`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (alternativeResponse.ok) {
        const metadata = await alternativeResponse.json() as OAuthMetadata;
        
        const config: OAuthConfig = {
          clientId: '',
          clientSecret: '',
          authorizationUrl: metadata.authorizationUrl || metadata.authorization_endpoint || '',
          tokenUrl: metadata.tokenUrl || metadata.token_endpoint || '',
          redirectUri: '',
          scope: metadata.scope || 'read write',
        };

        return {
          hasOAuth: true,
          config,
        };
      }

      return {
        hasOAuth: false,
      };
    } catch (error) {
      console.warn('OAuth discovery failed:', error);
      return {
        hasOAuth: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async initiateOAuthFlow(input: OAuthFlowInput): Promise<{ authorizationUrl: string; state: string }> {
    const service = await this.db.getService(input.serviceId);
    if (!service) {
      throw new Error(`Service ${input.serviceId} not found`);
    }

    if (!service.oauthAuthorizationUrl) {
      throw new Error('Service does not have OAuth configuration');
    }

    // Generate state parameter for security
    const state = randomBytes(32).toString('hex');
    
    // Store state in database - we'll need to add this field to the update method
    // For now, we'll store it in a different way or skip it
    // await this.db.updateService(input.serviceId, {
    //   oauthState: state,
    // });

    // Build authorization URL
    const url = new URL(service.oauthAuthorizationUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', service.oauthClientId || '');
    url.searchParams.set('redirect_uri', input.redirectUri);
    url.searchParams.set('scope', service.oauthScope || 'read write');
    url.searchParams.set('state', state);

    return {
      authorizationUrl: url.toString(),
      state,
    };
  }

  async handleOAuthCallback(input: OAuthCallbackInput): Promise<OAuthToken> {
    const service = await this.db.getService(input.serviceId);
    if (!service) {
      throw new Error(`Service ${input.serviceId} not found`);
    }

    // Verify state parameter - we'll need to implement this properly
    // if (service.oauthState !== input.state) {
    //   throw new Error('Invalid OAuth state parameter');
    // }

    if (!service.oauthTokenUrl) {
      throw new Error('Service does not have OAuth token URL configured');
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(service.oauthTokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: service.oauthClientId || '',
        client_secret: service.oauthClientSecret || '',
        code: input.code,
        redirect_uri: service.oauthRedirectUri || '',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`OAuth token exchange failed: ${tokenResponse.status} ${errorText}`);
    }

    const tokenData = await tokenResponse.json() as OAuthTokenResponse;
    
    const token: OAuthToken = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_in ? 
        new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : 
        undefined,
      tokenType: tokenData.token_type || 'Bearer',
      scope: tokenData.scope,
    };

    // Store tokens in database
    await this.db.updateOAuthTokens(
      input.serviceId,
      token.accessToken,
      token.refreshToken,
      token.expiresAt
    );

    // Clear state - we'll need to implement this properly
    // await this.db.updateService(input.serviceId, {
    //   oauthState: undefined,
    // });

    return token;
  }

  async refreshOAuthToken(input: OAuthRefreshInput): Promise<OAuthToken> {
    const service = await this.db.getService(input.serviceId);
    if (!service) {
      throw new Error(`Service ${input.serviceId} not found`);
    }

    if (!service.oauthTokenUrl) {
      throw new Error('Service does not have OAuth token URL configured');
    }

    // Exchange refresh token for new access token
    const tokenResponse = await fetch(service.oauthTokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: service.oauthClientId || '',
        client_secret: service.oauthClientSecret || '',
        refresh_token: input.refreshToken,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`OAuth token refresh failed: ${tokenResponse.status} ${errorText}`);
    }

    const tokenData = await tokenResponse.json() as OAuthTokenResponse;
    
    const token: OAuthToken = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || input.refreshToken,
      expiresAt: tokenData.expires_in ? 
        new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : 
        undefined,
      tokenType: tokenData.token_type || 'Bearer',
      scope: tokenData.scope,
    };

    // Store new tokens in database
    await this.db.updateOAuthTokens(
      input.serviceId,
      token.accessToken,
      token.refreshToken,
      token.expiresAt
    );

    return token;
  }

  async isTokenExpired(serviceId: string): Promise<boolean> {
    const service = await this.db.getService(serviceId);
    if (!service || !service.oauthTokenExpiresAt) {
      return true;
    }

    const expiresAt = new Date(service.oauthTokenExpiresAt);
    const now = new Date();
    
    // Consider token expired if it expires within the next 5 minutes
    return expiresAt.getTime() <= now.getTime() + 5 * 60 * 1000;
  }

  async getValidAccessToken(serviceId: string): Promise<string | null> {
    const service = await this.db.getService(serviceId);
    if (!service || !service.oauthAccessToken) {
      return null;
    }

    // Check if token is expired
    if (await this.isTokenExpired(serviceId)) {
      // Try to refresh the token
      if (service.oauthRefreshToken) {
        try {
          const newToken = await this.refreshOAuthToken({
            serviceId,
            refreshToken: service.oauthRefreshToken,
          });
          return newToken.accessToken;
        } catch (error) {
          console.error(`Failed to refresh OAuth token for service ${serviceId}:`, error);
          return null;
        }
      } else {
        return null;
      }
    }

    return service.oauthAccessToken;
  }
}
