import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ServiceManager } from '../services/service-manager';
import { ApiResponse, Service, ServiceTool } from '@agent-deck/shared';

// OAuth discovery functions
async function extractUrlsFromWWWAuthenticate(headerValue: string): Promise<string[]> {
  if (!headerValue) return [];
  const urlRegex = /https?:\/\/[^\s,;\"]+/g;
  return headerValue.match(urlRegex) || [];
}

async function getBaseOrigin(url: string): Promise<string> {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
}

async function probeWWWAuthenticate(url: string): Promise<{ wwwAuth: string | null; response: Response | null }> {
  const headersCommon = {
    'Accept': 'application/json, text/event-stream',
    'Content-Type': 'application/json',
  };
  
  try {
    // Try GET first
    const getResp = await fetch(url, { 
      method: 'GET',
      headers: { 'Accept': headersCommon.Accept }
    });
    const www = getResp.headers.get('www-authenticate');
    if (www) {
      return { wwwAuth: www, response: getResp };
    }
  } catch (error) {
    // Ignore GET errors
  }

  try {
    // Try POST minimal JSON-RPC envelope
    const payload = { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} };
    const postResp = await fetch(url, {
      method: 'POST',
      headers: headersCommon,
      body: JSON.stringify(payload)
    });
    const www = postResp.headers.get('www-authenticate');
    if (www) {
      return { wwwAuth: www, response: postResp };
    }
    return { wwwAuth: null, response: postResp };
  } catch (error) {
    return { wwwAuth: null, response: null };
  }
}

async function fetchProtectedResourceMetadata(baseOrigin: string): Promise<any> {
  const prUrl = `${baseOrigin}/.well-known/oauth-protected-resource`;
  try {
    const response = await fetch(prUrl);
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Fetched OAuth metadata from ${prUrl}:`, data);
      return { protectedResourceConfigUrl: prUrl, raw: data };
    } else {
      console.log(`⚠️ OAuth metadata not found at ${prUrl}: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Error fetching OAuth metadata from ${prUrl}:`, error);
  }
  return { protectedResourceConfigUrl: prUrl };
}

async function fetchAuthorizationServerMetadata(issuerOrAsUrl: string): Promise<any> {
  // If it's already a well-known URL, use as-is; otherwise append well-known path
  let asUrl = issuerOrAsUrl;
  if (!asUrl.includes('/.well-known/')) {
    asUrl = asUrl.replace(/\/$/, '') + '/.well-known/oauth-authorization-server';
  }
  
  try {
    const response = await fetch(asUrl);
    if (response.ok) {
      const data = await response.json() as any;
      return {
        authorizationServerMetadataUrl: asUrl,
        authorizationUrl: data.authorization_endpoint,
        tokenUrl: data.token_endpoint,
        issuer: data.issuer,
        raw: data,
      };
    }
  } catch (error) {
    // Ignore errors
  }
  return { authorizationServerMetadataUrl: asUrl };
}

async function discoverOAuthInfo(url: string): Promise<any> {
  const { wwwAuth, response } = await probeWWWAuthenticate(url);
  
  if (wwwAuth) {
    const urls = await extractUrlsFromWWWAuthenticate(wwwAuth);
    const oauthInfo: any = {
      required: true,
      wwwAuthenticate: wwwAuth,
      discoveredUrls: urls,
    };
    
    // Heuristic: pick the first url as authorizationUrl
    if (urls.length > 0) {
      oauthInfo.authorizationUrl = urls[0];
    }
    
    // Prefer OAuth Protected Resource metadata (RFC 9449) to discover AS
    const baseOrigin = await getBaseOrigin(url);
    const prMeta = await fetchProtectedResourceMetadata(baseOrigin);
    Object.assign(oauthInfo, prMeta);
    
    // If protected resource metadata exposes authorization_servers, fetch AS metadata
    const authServers = (prMeta.raw || {}).authorization_servers || [];
    if (authServers.length > 0) {
      // Use the first AS listed
      const asMeta = await fetchAuthorizationServerMetadata(authServers[0]);
      // If endpoints found, mark required
      if (asMeta.authorizationUrl || asMeta.tokenUrl) {
        oauthInfo.required = true;
      }
      Object.assign(oauthInfo, asMeta);
    }
    
    // Add OAuth configuration information for the frontend
    if (prMeta.raw) {
      oauthInfo.resourceName = prMeta.raw.resource_name;
      oauthInfo.scopesSupported = prMeta.raw.scopes_supported || [];
      oauthInfo.bearerMethodsSupported = prMeta.raw.bearer_methods_supported || [];
      
      // For GitHub OAuth, provide standard endpoints
      if (authServers.includes('https://github.com/login/oauth')) {
        oauthInfo.authorizationUrl = 'https://github.com/login/oauth/authorize';
        oauthInfo.tokenUrl = 'https://github.com/login/oauth/access_token';
        oauthInfo.provider = 'github';
      }
    }
    
    return oauthInfo;
  }
  
  return { required: false };
}

// Request schemas
const DiscoverMCPRequest = z.object({
  url: z.string().url(),
});

type DiscoverMCPRequestType = z.infer<typeof DiscoverMCPRequest>;

export default async function mcpRoutes(fastify: FastifyInstance) {
  // Discover and analyze an MCP server
  fastify.post<{ Body: DiscoverMCPRequestType }>('/discover', async (request, reply) => {
    try {
      const { url } = request.body;
      
      fastify.log.info(`🔍 Discovering MCP server: ${url}`);
      
      // Get the service manager from the app state
      const serviceManager = fastify.serviceManager;
      
      // Create a temporary service for discovery
      const tempService: Service = {
        id: 'temp-discovery',
        name: 'Discovery Service',
        type: 'mcp',
        url,
        health: 'unknown',
        description: '',
        cardColor: '#7ed4da',
        isConnected: false,
        lastPing: undefined,
        registeredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        headers: undefined,
        oauthClientId: undefined,
        oauthClientSecret: undefined,
        oauthAuthorizationUrl: undefined,
        oauthTokenUrl: undefined,
        oauthRedirectUri: undefined,
        oauthScope: undefined,
        oauthAccessToken: undefined,
        oauthRefreshToken: undefined,
        oauthTokenExpiresAt: undefined,
        oauthState: undefined,
      };
      
      // Try to discover tools using MCP client directly
      let tools: ServiceTool[] = [];
      let isValid = false;
      let error: string | null = null;
      
      try {
        const toolsResult = await serviceManager.mcpClientManager.discoverTools(tempService);
        tools = toolsResult || [];
        isValid = true;
      } catch (e) {
        error = e instanceof Error ? e.message : 'Unknown error';
      }
      
      // Check service health
      let health = 'unknown';
      try {
        const healthResult = await serviceManager.checkServiceHealth(tempService.id);
        if (healthResult.success) {
          health = healthResult.health;
        }
      } catch (e) {
        // Ignore health check errors for discovery
      }
      
      // OAuth discovery when tool discovery fails or returns empty (likely protected)
      let oauthInfo: any = { required: false };
      if (!isValid || tools.length === 0) {
        try {
          oauthInfo = await discoverOAuthInfo(url);
        } catch (e) {
          fastify.log.warn(`OAuth discovery failed for ${url}: ${e}`);
        }
      }
      
      // Build analysis response
      const analysis = {
        success: isValid,
        transport_type: 'http', // Default for now
        url,
        tools_count: tools.length,
        tools,
        capabilities: {
          supports_tool_discovery: isValid,
          supports_tool_calling: isValid
        },
        oauth: oauthInfo,
        health,
        error: error || null,
      };
      
      fastify.log.info(`✅ MCP discovery completed for ${url}: ${tools.length} tools found`);
      
      const response: ApiResponse<typeof analysis> = {
        success: true,
        data: analysis,
      };
      
      return reply.send(response);
      
    } catch (error) {
      fastify.log.error(`Error discovering MCP server: ${error}`);
      
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      return reply.status(500).send(response);
    }
  });
}
