import http from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import { MCPClientManager } from './mcp-client-manager';

function readJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function createStreamableMcpServer() {
  return http.createServer(async (req, res) => {
    if (req.method === 'GET') {
      res.writeHead(405);
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(404);
      res.end();
      return;
    }

    const body = await readJsonBody(req);

    if (body.method === 'initialize') {
      res.writeHead(200, {
        'content-type': 'application/json',
        'mcp-session-id': 'mock-session',
      });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: {
          protocolVersion: '2025-03-26',
          capabilities: { tools: {} },
          serverInfo: { name: 'mock-streamable', version: '1.0.0' },
        },
      }));
      return;
    }

    if (body.method === 'notifications/initialized') {
      res.writeHead(202);
      res.end();
      return;
    }

    if (body.method === 'tools/list') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: {
          tools: [{
            name: 'echo',
            description: 'Echo input',
            inputSchema: { type: 'object' },
          }],
        },
      }));
      return;
    }

    res.writeHead(404);
    res.end();
  });
}

describe('MCPClientManager', () => {
  const servers: http.Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve())),
    ));
  });

  it('discovers tools from a Streamable HTTP MCP server', async () => {
    const server = createStreamableMcpServer();
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;

    const manager = new MCPClientManager();
    const tools = await manager.discoverTools({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Mock Streamable',
      type: 'mcp',
      url: `http://127.0.0.1:${port}/mcp`,
      health: 'unknown',
      cardColor: '#92E4DD',
      disabledToolNames: [],
      isConnected: false,
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(tools).toEqual([{
      name: 'echo',
      description: 'Echo input',
      inputSchema: { type: 'object' },
    }]);
  });
});
