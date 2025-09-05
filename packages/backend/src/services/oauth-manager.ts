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
  private oauthStates = new Map<string, string>(); // state -> serviceId mapping

  getOAuthState(state: string): string | undefined {
    return this.oauthStates.get(state);
  }

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
    
    // Store state mapping in memory
    this.oauthStates.set(state, input.serviceId);

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
    // Extract service ID from state parameter
    const serviceId = this.oauthStates.get(input.state);
    if (!serviceId) {
      throw new Error('Invalid or expired OAuth state parameter');
    }

    // Clean up the state after successful retrieval
    this.oauthStates.delete(input.state);

    const service = await this.db.getService(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    if (!service.oauthTokenUrl) {
      throw new Error('Service does not have OAuth token URL configured');
    }

    // Use the exact same redirect URI that was used in the authorization request
    // This should match the redirect URI stored in the service configuration
    const redirectUri = service.oauthRedirectUri || 'http://localhost:3000/oauth/callback';
    
    console.log('OAuth callback debug:', {
      serviceId: input.serviceId,
      clientId: service.oauthClientId,
      redirectUri,
      tokenUrl: service.oauthTokenUrl,
    });

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
        redirect_uri: redirectUri,
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
      serviceId,
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

  async autoRegisterOAuthApp(serviceUrl: string, config: OAuthConfig): Promise<{
    success: boolean;
    clientId?: string;
    clientSecret?: string;
    error?: string;
    registrationUrl?: string;
  }> {
    try {
      const baseUrl = new URL(serviceUrl);
      console.log('Attempting OAuth auto-registration for:', serviceUrl);
      
      // Step 1: Try to get OAuth information from the MCP service itself
      console.log('Step 1: Checking MCP service OAuth capabilities');
      
      try {
        // Try to get OAuth metadata from the MCP service
        const oauthMetadataUrl = `${baseUrl.origin}/.well-known/oauth-authorization-server`;
        console.log('Trying OAuth metadata at:', oauthMetadataUrl);
        
        const metadataResponse = await fetch(oauthMetadataUrl);
        if (metadataResponse.ok) {
          const metadata = await metadataResponse.json() as any;
          console.log('OAuth metadata found:', metadata);
          
          if (metadata.registration_endpoint) {
            console.log('Found registration endpoint:', metadata.registration_endpoint);
            
            // Try dynamic client registration with the MCP service
            const registrationResponse = await fetch(metadata.registration_endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
              body: JSON.stringify({
                client_name: 'AgentDeck',
                redirect_uris: [`http://localhost:8000/api/oauth/callback`],
                grant_types: ['authorization_code', 'refresh_token'],
                response_types: ['code'],
                token_endpoint_auth_method: 'client_secret_basic',
                scope: config.scope || 'read write',
              }),
            });

            if (registrationResponse.ok) {
              const data = await registrationResponse.json() as any;
              console.log('Dynamic client registration successful:', data);
              
              // Validate that we got real client credentials
              if (data.client_id && data.client_secret && 
                  typeof data.client_id === 'string' && 
                  typeof data.client_secret === 'string' &&
                  data.client_id.length > 10 && 
                  data.client_secret.length > 10) {
                return {
                  success: true,
                  clientId: data.client_id,
                  clientSecret: data.client_secret,
                };
              } else {
                console.log('Invalid client credentials received from MCP service');
              }
            } else {
              console.log('MCP service registration failed:', await registrationResponse.text());
            }
          } else {
            console.log('No registration endpoint found in MCP service OAuth metadata');
          }
        } else {
          console.log('MCP service OAuth metadata not found at:', oauthMetadataUrl);
        }
      } catch (error) {
        console.log('Failed to get OAuth metadata from MCP service:', error);
      }

      // Step 2: Try MCP service-specific OAuth registration endpoints
      console.log('Step 2: Trying MCP service-specific OAuth registration');
      
      const mcpOAuthEndpoints = [
        `${serviceUrl}/oauth/register`,
        `${serviceUrl}/oauth/credentials`,
        `${baseUrl.origin}/oauth/register`,
        `${baseUrl.origin}/oauth/credentials`,
      ];

      for (const endpoint of mcpOAuthEndpoints) {
        try {
          console.log('Trying MCP OAuth endpoint:', endpoint);
          
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              client_name: 'AgentDeck',
              redirect_uri: `http://localhost:8000/api/oauth/callback`,
              scope: config.scope || 'read write',
            }),
          });

          if (response.ok) {
            const data = await response.json() as any;
            console.log('MCP OAuth registration successful at:', endpoint, data);
            
            // Validate that we got real client credentials
            if (data.client_id && data.client_secret && 
                typeof data.client_id === 'string' && 
                typeof data.client_secret === 'string' &&
                data.client_id.length > 10 && 
                data.client_secret.length > 10) {
              return {
                success: true,
                clientId: data.client_id,
                clientSecret: data.client_secret,
              };
            } else {
              console.log('Invalid client credentials received from MCP endpoint:', endpoint);
            }
          } else {
            console.log('MCP OAuth endpoint failed:', endpoint, await response.text());
          }
        } catch (error) {
          console.log('MCP OAuth endpoint error:', endpoint, error);
        }
      }

      // Step 3: If all automated methods fail, provide generic manual registration instructions
      console.log('Step 3: All automated registration methods failed, providing manual instructions');
      
      return {
        success: false,
        error: 'This OAuth provider requires manual registration. Please create an OAuth application and add your credentials.',
      };
    } catch (error) {
      console.log('OAuth auto-registration failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Auto-registration failed',
      };
    }
  }
}
