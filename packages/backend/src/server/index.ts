import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { DatabaseManager } from '../models/database';
import { ServiceManager } from '../services/service-manager';
import { MCPClientManager } from '../services/mcp-client-manager';
import { OAuthManager } from '../services/oauth-manager';
import { registerServiceRoutes } from '../routes/services';
import { registerDeckRoutes } from '../routes/decks';
import { registerOAuthRoutes } from '../routes/oauth';
import { registerWebSocketRoutes } from '../routes/websocket';
import mcpRoutes from '../routes/mcp';
import { ServiceStatusUpdate, DeckUpdate, WebSocketMessage } from '@agent-deck/shared';

export async function createServer() {
  const fastify = Fastify({
    logger: {
      level: 'info',
    },
  });

  // Register plugins
  await fastify.register(cors, {
    origin: true, // Allow all origins in development
    credentials: true,
  });

  await fastify.register(websocket);

  // Initialize services
  const db = new DatabaseManager();
  const mcpClient = new MCPClientManager();
  const oauthManager = new OAuthManager(db);
  const serviceManager = new ServiceManager(db, mcpClient, oauthManager);

  // Register routes
  await fastify.register(registerWebSocketRoutes, { prefix: '/api/ws' });
  await fastify.register(registerServiceRoutes, { prefix: '/api/services' });
  await fastify.register(registerDeckRoutes, { prefix: '/api/decks' });
  await fastify.register(registerOAuthRoutes, { prefix: '/api/oauth' });
  await fastify.register(mcpRoutes, { prefix: '/api/mcp' });

  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Root endpoint
  fastify.get('/', async (request, reply) => {
    return { 
      name: 'Agent Deck Backend',
      version: '1.0.0',
      status: 'running',
    };
  });

  // Add services to request context
  fastify.decorate('db', db);
  fastify.decorate('serviceManager', serviceManager);
  fastify.decorate('mcpClient', mcpClient);
  fastify.decorate('oauthManager', oauthManager);

  // Add broadcast decorators for WebSocket functionality
  fastify.decorate('broadcastServiceUpdate', (update: ServiceStatusUpdate) => {
    console.log('Broadcasting service update:', update);
    // This will be implemented when WebSocket is properly connected
  });

  fastify.decorate('broadcastDeckUpdate', (update: DeckUpdate) => {
    console.log('Broadcasting deck update:', update);
    // This will be implemented when WebSocket is properly connected
  });

  fastify.decorate('broadcastToAll', (message: WebSocketMessage) => {
    console.log('Broadcasting to all:', message);
    // This will be implemented when WebSocket is properly connected
  });

  return fastify;
}

// Extend FastifyInstance to include our services
declare module 'fastify' {
  interface FastifyInstance {
    db: DatabaseManager;
    serviceManager: ServiceManager;
    mcpClient: MCPClientManager;
    oauthManager: OAuthManager;
    broadcastServiceUpdate: (update: ServiceStatusUpdate) => void;
    broadcastDeckUpdate: (update: DeckUpdate) => void;
    broadcastToAll: (message: WebSocketMessage) => void;
  }
}
