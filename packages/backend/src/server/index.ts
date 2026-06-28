import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseManager } from '../models/database';
import { ServiceManager } from '../services/service-manager';
import { MCPClientManager } from '../services/mcp-client-manager';
import { OAuthManager } from '../services/oauth-manager';
import { registerServiceRoutes } from '../routes/services';
import { registerDeckRoutes } from '../routes/decks';
import { registerOAuthRoutes } from '../routes/oauth';
import { registerWebSocketRoutes } from '../routes/websocket';
import mcpRoutes from '../routes/mcp';
import { registerLocalMCPRoutes } from '../routes/local-mcp';
import { registerCredentialRoutes } from '../routes/credentials';
import { registerScopeRoutes } from '../routes/scope';
import { registerPlaybookRoutes } from '../routes/playbooks';
import { ServiceStatusUpdate, DeckUpdate, WebSocketMessage } from '@agent-deck/shared';
import { createSecretStore, CredentialManager } from '../vault';
import { resolveDatabasePath } from '../lib/paths';
import { CollectionWarningService } from '../services/collection-warning-service';
import { registerCollectionRoutes } from '../routes/collection';
import { PlaybookManager } from '../playbooks/playbook-manager';
import { getAgentDeckVersion } from '../lib/version';

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
  const db = new DatabaseManager(resolveDatabasePath());
  const mcpClient = new MCPClientManager();
  const oauthManager = new OAuthManager(db);
  const serviceManager = new ServiceManager(db, mcpClient, oauthManager);
  const credentialManager = new CredentialManager(db, createSecretStore());
  const playbookManager = new PlaybookManager(db);
  const collectionWarningService = new CollectionWarningService();

  // Register routes
  await fastify.register(registerWebSocketRoutes, { prefix: '/api/ws' });
  await fastify.register(registerServiceRoutes, { prefix: '/api/services' });
  await fastify.register(registerDeckRoutes, { prefix: '/api/decks' });
  await fastify.register(registerCredentialRoutes, { prefix: '/api/credentials' });
  await fastify.register(registerScopeRoutes, { prefix: '/api/scope' });
  await fastify.register(registerPlaybookRoutes, { prefix: '/api/playbooks' });
  await fastify.register(registerCollectionRoutes, { prefix: '/api/collection' });
  await fastify.register(registerOAuthRoutes, { prefix: '/api/oauth' });
  await fastify.register(mcpRoutes, { prefix: '/api/mcp' });
  await fastify.register(registerLocalMCPRoutes, { prefix: '/api/local-mcp' });

  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString(), version: getAgentDeckVersion() };
  });

  const uiDist = process.env.AGENT_DECK_UI_DIST?.trim();
  if (uiDist && fs.existsSync(uiDist)) {
    await fastify.register(fastifyStatic, {
      root: path.resolve(uiDist),
      prefix: '/',
    });

    fastify.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.status(404).send({ success: false, error: 'Not found' });
      }
      return reply.sendFile('index.html', path.resolve(uiDist));
    });
  } else if (!uiDist) {
    // Root endpoint when UI is not bundled (API-only mode)
    fastify.get('/', async () => ({
      name: 'Agent Deck Backend',
      version: getAgentDeckVersion(),
      status: 'running',
    }));
  }

  // Add services to request context
  fastify.decorate('db', db);
  fastify.decorate('serviceManager', serviceManager);
  fastify.decorate('mcpClient', mcpClient);
  fastify.decorate('oauthManager', oauthManager);
  fastify.decorate('credentialManager', credentialManager);
  fastify.decorate('playbookManager', playbookManager);
  fastify.decorate('collectionWarningService', collectionWarningService);

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
    credentialManager: CredentialManager;
    playbookManager: PlaybookManager;
    collectionWarningService: CollectionWarningService;
    broadcastServiceUpdate: (update: ServiceStatusUpdate) => void;
    broadcastDeckUpdate: (update: DeckUpdate) => void;
    broadcastToAll: (message: WebSocketMessage) => void;
  }
}
