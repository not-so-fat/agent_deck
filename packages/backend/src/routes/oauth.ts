import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  OAuthFlowInput,
  OAuthCallbackInput,
  OAuthRefreshInput,
  ApiResponse,
  OAuthDiscoveryResult,
  OAuthToken
} from '@agent-deck/shared';
import { MCPDiscoveryService } from '../services/mcp-discovery-service';

interface OAuthFlowRequest {
  Params: { serviceId: string };
  Querystring: { redirectUri: string };
}

interface OAuthCallbackRequest {
  Params: { serviceId: string };
  Querystring: { code: string; state: string };
}

interface OAuthRefreshRequest {
  Params: { serviceId: string };
  Body: { refreshToken: string };
}

interface ServiceIdRequest {
  Params: { serviceId: string };
}

export async function registerOAuthRoutes(fastify: FastifyInstance) {
  // Discover OAuth configuration for a service
  fastify.get<ServiceIdRequest>('/:serviceId/discover', async (request, reply) => {
    try {
      const service = await fastify.db.getService(request.params.serviceId);
      if (!service) {
        const response: ApiResponse = {
          success: false,
          error: 'Service not found',
        };
        
        return reply.status(404).send(response);
      }

      const discovery = await fastify.oauthManager.discoverOAuth(service.url);
      
      const response: ApiResponse<OAuthDiscoveryResult> = {
        success: true,
        data: discovery,
      };
      
      return reply.send(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      return reply.status(500).send(response);
    }
  });

  // Auto-register OAuth application and initiate flow
  fastify.post<ServiceIdRequest>('/:serviceId/auto-setup', async (request, reply) => {
    try {
      const service = await fastify.db.getService(request.params.serviceId);
      if (!service) {
        const response: ApiResponse = {
          success: false,
          error: 'Service not found',
        };
        
        return reply.status(404).send(response);
      }

      // Use MCP discovery service to get OAuth configuration
      const discoveryService = new MCPDiscoveryService();
      const mcpDiscovery = await discoveryService.discoverService(service.url);
      
      if (!mcpDiscovery.oauth.required) {
        const response: ApiResponse = {
          success: false,
          error: 'Service does not require OAuth authentication',
        };
        
        return reply.status(400).send(response);
      }

      // Convert MCP discovery to OAuth config format
      const oauthConfig = {
        clientId: '', // Will be provided by auto-registration
        clientSecret: '', // Will be provided by auto-registration
        authorizationUrl: mcpDiscovery.oauth.authorizationUrl || '',
        tokenUrl: mcpDiscovery.oauth.tokenUrl || '',
        redirectUri: `http://localhost:8000/api/oauth/callback`,
        scope: mcpDiscovery.oauth.scopesSupported?.[0] || 'read write',
      };

      // Auto-register OAuth application
      const registration = await fastify.oauthManager.autoRegisterOAuthApp(service.url, oauthConfig);
      if (!registration.success) {
        const response: ApiResponse = {
          success: false,
          error: registration.error || 'Failed to auto-register OAuth application',
          data: registration.registrationUrl ? { registrationUrl: registration.registrationUrl } : undefined,
        };
        
        return reply.status(400).send(response);
      }

      // Update service with OAuth credentials
      await fastify.db.updateService(request.params.serviceId, {
        oauthClientId: registration.clientId,
        oauthClientSecret: registration.clientSecret,
        oauthAuthorizationUrl: oauthConfig.authorizationUrl,
        oauthTokenUrl: oauthConfig.tokenUrl,
        oauthRedirectUri: oauthConfig.redirectUri,
        oauthScope: oauthConfig.scope,
      });

      // Initiate OAuth flow
      const { authorizationUrl, state } = await fastify.oauthManager.initiateOAuthFlow({
        serviceId: request.params.serviceId,
        redirectUri: `http://localhost:8000/api/oauth/callback`,
      });
      
      const response: ApiResponse = {
        success: true,
        data: {
          authorizationUrl,
          state,
          clientId: registration.clientId,
          message: 'OAuth application registered and authorization flow initiated',
        },
      };
      
      return reply.send(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      return reply.status(400).send(response);
    }
  });

  // Initiate OAuth flow (existing endpoint)
  fastify.get<OAuthFlowRequest>('/:serviceId/authorize', async (request, reply) => {
    try {
      const { authorizationUrl, state } = await fastify.oauthManager.initiateOAuthFlow({
        serviceId: request.params.serviceId,
        redirectUri: request.query.redirectUri,
      });
      
      const response: ApiResponse = {
        success: true,
        data: {
          authorizationUrl,
          state,
        },
      };
      
      return reply.send(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      return reply.status(400).send(response);
    }
  });

  // Handle OAuth callback (generic endpoint for all services)
  fastify.get('/callback', async (request, reply) => {
    try {
      const { code, state } = request.query as { code: string; state: string };
      
      if (!code || !state) {
        const response: ApiResponse = {
          success: false,
          error: 'Missing authorization code or state parameter',
        };
        return reply.status(400).send(response);
      }

      // Extract service ID from state using OAuth manager's state mapping
      const serviceId = fastify.oauthManager.getOAuthState(state);
      
      if (!serviceId) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid or expired OAuth state',
        };
        return reply.status(400).send(response);
      }

      const token = await fastify.oauthManager.handleOAuthCallback({
        serviceId,
        code,
        state,
      });
      
      // Redirect to frontend with success status
      return reply.redirect(`http://localhost:3000/oauth/callback?success=true&serviceId=${serviceId}`);
    } catch (error) {
      // Redirect to frontend with error status
      const errorMessage = error instanceof Error ? error.message : 'OAuth callback failed';
      return reply.redirect(`http://localhost:3000/oauth/callback?success=false&error=${encodeURIComponent(errorMessage)}`);
    }
  });

  // Handle OAuth callback (legacy endpoint with service ID)
  fastify.get<OAuthCallbackRequest>('/:serviceId/callback', async (request, reply) => {
    try {
      const token = await fastify.oauthManager.handleOAuthCallback({
        serviceId: request.params.serviceId,
        code: request.query.code,
        state: request.query.state,
      });
      
      const response: ApiResponse<OAuthToken> = {
        success: true,
        data: token,
        message: 'OAuth authentication successful',
      };
      
      return reply.send(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      return reply.status(400).send(response);
    }
  });

  // Refresh OAuth token
  fastify.post<OAuthRefreshRequest>('/:serviceId/refresh', async (request, reply) => {
    try {
      const token = await fastify.oauthManager.refreshOAuthToken({
        serviceId: request.params.serviceId,
        refreshToken: request.body.refreshToken,
      });
      
      const response: ApiResponse<OAuthToken> = {
        success: true,
        data: token,
        message: 'OAuth token refreshed successfully',
      };
      
      return reply.send(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      return reply.status(400).send(response);
    }
  });

  // Get OAuth status for a service
  fastify.get<ServiceIdRequest>('/:serviceId/status', async (request, reply) => {
    try {
      const service = await fastify.db.getService(request.params.serviceId);
      if (!service) {
        const response: ApiResponse = {
          success: false,
          error: 'Service not found',
        };
        
        return reply.status(404).send(response);
      }

      const isExpired = await fastify.oauthManager.isTokenExpired(request.params.serviceId);
      const hasToken = !!service.oauthAccessToken;
      
      const response: ApiResponse = {
        success: true,
        data: {
          hasToken,
          isExpired,
          hasRefreshToken: !!service.oauthRefreshToken,
          expiresAt: service.oauthTokenExpiresAt,
        },
      };
      
      return reply.send(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      return reply.status(500).send(response);
    }
  });
}
