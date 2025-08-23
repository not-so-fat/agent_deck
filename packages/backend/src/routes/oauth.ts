import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  OAuthFlowInput,
  OAuthCallbackInput,
  OAuthRefreshInput,
  ApiResponse,
  OAuthDiscoveryResult,
  OAuthToken
} from '@agent-deck/shared';

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

  // Initiate OAuth flow
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

  // Handle OAuth callback
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
