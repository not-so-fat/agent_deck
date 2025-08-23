#!/usr/bin/env node

import Fastify from 'fastify';
import cors from '@fastify/cors';

async function main() {
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
      description: 'AgentDeck MCP Server - HTTP Interface',
      endpoints: {
        streamable: `http://${host}:${port}/mcp`,
        health: `http://${host}:${port}/health`
      }
    };
  });

  // Simple MCP protocol endpoint
  fastify.post('/mcp', async (request, reply) => {
    const { jsonrpc, id, method, params } = request.body as any;
    
    console.log(`📥 Received MCP request: ${method}`);
    
    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
            prompts: {}
          },
          serverInfo: {
            name: 'agent-deck-mcp-server',
            version: '1.0.0'
          }
        }
      };
    }
    
    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: []
        }
      };
    }
    
    if (method === 'resources/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          resources: []
        }
      };
    }
    
    if (method === 'prompts/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          prompts: []
        }
      };
    }
    
    // Unknown method
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: 'Method not found'
      }
    };
  });

  // Start server
  try {
    await fastify.listen({ port, host });
    console.log(`🚀 Agent Deck MCP HTTP Server running on http://${host}:${port}`);
    console.log(`📊 MCP Endpoint: http://${host}:${port}/mcp`);
    console.log(`🔧 Configure in Cursor: http://${host}:${port}/mcp`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down MCP HTTP server...');
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
