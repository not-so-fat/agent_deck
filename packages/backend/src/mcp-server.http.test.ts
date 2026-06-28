import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AgentDeckMCPServer } from './mcp-server';

const MCP_ACCEPT = 'application/json, text/event-stream';

function initializePayload(id = 1) {
  return {
    jsonrpc: '2.0',
    id,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'vitest', version: '1.0.0' },
    },
  };
}

async function waitForMcpHealth(port: number): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`MCP server on :${port} did not become healthy`);
}

async function postInitialize(port: number, id = 1) {
  return fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: MCP_ACCEPT,
    },
    body: JSON.stringify(initializePayload(id)),
  });
}

describe('AgentDeckMCPServer streamable HTTP', () => {
  let port: number;
  let mcpServer: AgentDeckMCPServer;

  beforeAll(async () => {
    port = 36_000 + Math.floor(Math.random() * 2_000);
    mcpServer = new AgentDeckMCPServer(port, 'http://127.0.0.1:1');
    await mcpServer.start();
    await waitForMcpHealth(port);
  });

  afterAll(async () => {
    await mcpServer.stop();
  });

  it('returns health metadata', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    const body = await response.json();
    expect(body.service).toBe('agent-deck-mcp-server');
  });

  it('allows multiple POST initialize sessions (regression: single global session)', async () => {
    const first = await postInitialize(port, 1);
    expect(first.status).toBe(200);
    const sessionOne = first.headers.get('mcp-session-id');
    expect(sessionOne).toBeTruthy();

    const second = await postInitialize(port, 2);
    expect(second.status).toBe(200);
    const sessionTwo = second.headers.get('mcp-session-id');
    expect(sessionTwo).toBeTruthy();
    expect(sessionTwo).not.toBe(sessionOne);
  });

  it('serves GET /mcp for an initialized session (Claude Code SSE stream)', async () => {
    const init = await postInitialize(port, 10);
    const sessionId = init.headers.get('mcp-session-id');
    expect(sessionId).toBeTruthy();

    const stream = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'GET',
      headers: {
        'mcp-session-id': sessionId!,
        Accept: 'text/event-stream',
      },
    });

    expect(stream.status).toBe(200);
    expect(stream.headers.get('content-type')).toContain('text/event-stream');
    await stream.body?.cancel();
  });

  it('rejects GET /mcp without a session id', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
    });
    expect(response.status).toBe(400);
  });

  it('rejects non-initialize POST without a session id', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: MCP_ACCEPT,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 99,
        method: 'tools/list',
        params: {},
      }),
    });
    expect(response.status).toBe(400);
  });
});
