#!/usr/bin/env node

import { AgentDeckMCPServer } from './server.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';

async function main() {
  const mcpServer = new AgentDeckMCPServer();
  const port = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT) : 3002;
  const host = process.env.MCP_HOST || 'localhost';

  // Create Fastify server
  const fastify = Fastify({
    logger: true
  });

  // Enable CORS
  await fastify.register(cors, {
    origin: true
  });

  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    return { status: 'ok', service: 'agent-deck-mcp-server' };
  });

  // MCP endpoint - returns server info
  fastify.get('/mcp', async (request, reply) => {
    return {
      name: 'agent-deck-mcp-server',
      version: '1.0.0',
      description: 'AgentDeck MCP Server - Streamable HTTP Interface',
      endpoints: {
        streamable: `http://${host}:${port}/mcp`,
        health: `http://${host}:${port}/health`
      }
    };
  });

  // Streamable HTTP endpoint for MCP communication
  fastify.all('/mcp', async (request, reply) => {
    try {
      // Create Streamable HTTP transport
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      });
      
      // Connect the MCP server to this transport
      await mcpServer.getServer().connect(transport);
      
      // Handle the HTTP request through the transport
      await transport.handleRequest(request.raw, reply.raw);
      
      console.log(`✅ MCP Streamable HTTP connection established`);
    } catch (error) {
      console.error('❌ Failed to handle MCP request:', error);
      reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // Start server
  try {
    await fastify.listen({ port, host });
    console.log(`🚀 Agent Deck MCP Streamable HTTP Server running on http://${host}:${port}`);
    console.log(`📊 MCP Endpoint: http://${host}:${port}/mcp`);
    console.log(`🔧 Configure in Cursor: http://${host}:${port}/mcp`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down MCP HTTP server...');
    await mcpServer.stop();
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
