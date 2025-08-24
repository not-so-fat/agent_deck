import { Service } from '@agent-deck/shared';

interface OAuthMetadata {
  resource_name?: string;
  scopes_supported?: string[];
  bearer_methods_supported?: string[];
  authorization_servers?: string[];
  authorization_endpoint?: string;
  token_endpoint?: string;
  issuer?: string;
}

interface MCPDiscoveryResult {
  success: boolean;
  transport_type: string;
  url: string;
  tools_count: number;
  tools: any[];
  capabilities: {
    supports_tool_discovery: boolean;
    supports_tool_calling: boolean;
  };
  oauth: {
    required: boolean;
    resourceName?: string;
    issuer?: string;
    authorizationUrl?: string;
    tokenUrl?: string;
    scopesSupported?: string[];
    bearerMethodsSupported?: string[];
    provider?: string;
    error?: string;
  };
  health: string;
  error: string | null;
}

export class MCPDiscoveryService {
  async discoverService(url: string): Promise<MCPDiscoveryResult> {
    const result: MCPDiscoveryResult = {
      success: false,
      transport_type: 'http',
      url,
      tools_count: 0,
      tools: [],
      capabilities: {
        supports_tool_discovery: false,
        supports_tool_calling: false,
      },
      oauth: {
        required: false,
      },
      health: 'unknown',
      error: null,
    };

    try {
      // First, check for OAuth requirements
      const oauthInfo = await this.detectOAuthRequirements(url);
      result.oauth = oauthInfo;
      
      if (oauthInfo.required) {
        // Service requires OAuth, mark as successful discovery
        result.success = true;
        result.health = 'oauth_required';
        return result;
      }

      // Try basic MCP discovery without OAuth
      const basicResult = await this.tryBasicDiscovery(url);
      return basicResult;
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      return result;
    }
  }

  private async tryBasicDiscovery(url: string): Promise<MCPDiscoveryResult> {
    const result: MCPDiscoveryResult = {
      success: false,
      transport_type: 'http',
      url,
      tools_count: 0,
      tools: [],
      capabilities: {
        supports_tool_discovery: false,
        supports_tool_calling: false,
      },
      oauth: {
        required: false,
      },
      health: 'unknown',
      error: null,
    };

    try {
      // Try a simple HTTP request to check if the service is reachable
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json, text/event-stream',
        },
      });

      if (response.ok) {
        result.success = true;
        result.health = 'healthy';
        result.capabilities.supports_tool_discovery = true;
        result.capabilities.supports_tool_calling = true;
      } else {
        result.error = `HTTP ${response.status}: ${response.statusText}`;
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Connection failed';
    }

    return result;
  }

  private async detectOAuthRequirements(url: string): Promise<MCPDiscoveryResult['oauth']> {
    const oauthInfo: MCPDiscoveryResult['oauth'] = {
      required: false,
    };

    try {
      // Check for OAuth metadata endpoints
      const baseUrl = new URL(url);
      
      // Try OAuth Protected Resource metadata (RFC 9449)
      const prUrl = `${baseUrl.origin}/.well-known/oauth-protected-resource`;
      try {
        const response = await fetch(prUrl);
        if (response.ok) {
          const data = await response.json() as OAuthMetadata;
          oauthInfo.required = true;
          oauthInfo.resourceName = data.resource_name;
          oauthInfo.scopesSupported = data.scopes_supported || [];
          oauthInfo.bearerMethodsSupported = data.bearer_methods_supported || [];
          
          // Check for authorization servers
          const authServers = data.authorization_servers || [];
          if (authServers.length > 0) {
            const asUrl = authServers[0];
            const asResponse = await fetch(`${asUrl}/.well-known/oauth-authorization-server`);
            if (asResponse.ok) {
              const asData = await asResponse.json() as OAuthMetadata;
              oauthInfo.authorizationUrl = asData.authorization_endpoint;
              oauthInfo.tokenUrl = asData.token_endpoint;
              oauthInfo.issuer = asData.issuer;
            }
          }
          
          return oauthInfo;
        }
      } catch (error) {
        // Ignore errors for this endpoint
      }

      // Try OAuth Authorization Server metadata
      const asUrl = `${baseUrl.origin}/.well-known/oauth-authorization-server`;
      try {
        const response = await fetch(asUrl);
        if (response.ok) {
          const data = await response.json() as OAuthMetadata;
          oauthInfo.required = true;
          oauthInfo.authorizationUrl = data.authorization_endpoint;
          oauthInfo.tokenUrl = data.token_endpoint;
          oauthInfo.issuer = data.issuer;
          oauthInfo.scopesSupported = data.scopes_supported || [];
          return oauthInfo;
        }
      } catch (error) {
        // Ignore errors for this endpoint
      }

      // Check for WWW-Authenticate header
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json, text/event-stream',
          },
        });
        
        const wwwAuth = response.headers.get('www-authenticate');
        if (wwwAuth && wwwAuth.toLowerCase().includes('oauth')) {
          oauthInfo.required = true;
          
          // Extract URLs from WWW-Authenticate header
          const urlRegex = /https?:\/\/[^\s,;\"]+/g;
          const urls = wwwAuth.match(urlRegex) || [];
          if (urls.length > 0) {
            oauthInfo.authorizationUrl = urls[0];
          }
          
          return oauthInfo;
        }
      } catch (error) {
        // Ignore errors for this check
      }

    } catch (error) {
      oauthInfo.error = error instanceof Error ? error.message : 'OAuth detection failed';
    }

    return oauthInfo;
  }
}
