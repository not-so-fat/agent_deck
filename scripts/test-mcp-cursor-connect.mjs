#!/usr/bin/env node
/**
 * Simulates Cursor's Chromium MCP client: CORS preflight + streamable HTTP session.
 * Usage: node .temporal/scripts/test-mcp-cursor-connect.mjs [baseUrl]
 */
const base = process.argv[2] ?? 'http://127.0.0.1:3001';
const mcp = `${base}/mcp`;
const health = `${base}/health`;

const failures = [];

function fail(name, detail) {
  failures.push({ name, detail });
  console.error(`FAIL  ${name}: ${detail}`);
}

function pass(name, detail = '') {
  console.log(`PASS  ${name}${detail ? `: ${detail}` : ''}`);
}

async function testHealth() {
  const res = await fetch(health);
  if (!res.ok) return fail('health', `HTTP ${res.status}`);
  const body = await res.json();
  if (body.status !== 'ok') return fail('health', JSON.stringify(body));
  pass('health');
}

async function testCorsPreflight() {
  const res = await fetch(mcp, {
    method: 'OPTIONS',
    headers: {
      Origin: 'vscode-file://vscode-app',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type, accept, mcp-session-id, mcp-protocol-version',
    },
  });
  if (res.status !== 204) {
    const text = await res.text();
    return fail('cors-preflight', `HTTP ${res.status} ${text.slice(0, 120)}`);
  }
  const acao = res.headers.get('access-control-allow-origin');
  if (!acao) return fail('cors-preflight', 'missing Access-Control-Allow-Origin');
  pass('cors-preflight', `allow-origin=${acao}`);
}

async function testInitialize() {
  const res = await fetch(mcp, {
    method: 'POST',
    headers: {
      Origin: 'vscode-file://vscode-app',
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'cursor-test', version: '1.0' },
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return fail('initialize', `HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  const sessionId = res.headers.get('mcp-session-id');
  if (!sessionId) return fail('initialize', 'missing mcp-session-id header');
  const body = await res.json();
  if (!body.result?.serverInfo?.name) return fail('initialize', JSON.stringify(body));
  pass('initialize', `session=${sessionId.slice(0, 8)}…`);
  return sessionId;
}

async function testSession(sessionId) {
  const headers = {
    Origin: 'vscode-file://vscode-app',
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'mcp-session-id': sessionId,
    'mcp-protocol-version': '2025-03-26',
  };

  await fetch(mcp, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  });

  const toolsRes = await fetch(mcp, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
  });
  const tools = await toolsRes.json();
  const count = tools.result?.tools?.length ?? 0;
  if (count < 1) return fail('tools/list', JSON.stringify(tools));
  pass('tools/list', `${count} tools`);

  const ac = new AbortController();
  setTimeout(() => ac.abort(), 1500);
  try {
    const sseRes = await fetch(mcp, {
      method: 'GET',
      headers: {
        Origin: 'vscode-file://vscode-app',
        Accept: 'text/event-stream',
        'mcp-session-id': sessionId,
        'mcp-protocol-version': '2025-03-26',
      },
      signal: ac.signal,
    });
    if (!sseRes.ok) return fail('get-sse', `HTTP ${sseRes.status}`);
    pass('get-sse', sseRes.headers.get('content-type') ?? '');
  } catch (e) {
    if (e.name === 'AbortError') pass('get-sse', 'stream opened');
    else fail('get-sse', e.message);
  }
}

async function testStaleSession() {
  const res = await fetch(mcp, {
    method: 'GET',
    headers: {
      Accept: 'text/event-stream',
      'mcp-session-id': '00000000-0000-0000-0000-000000000000',
    },
  });
  const body = await res.json();
  if (res.status !== 404 || body.error?.code !== -32001) {
    return fail('stale-session', `HTTP ${res.status} ${JSON.stringify(body)}`);
  }
  pass('stale-session', '404 Session not found');
}

async function main() {
  console.log(`Testing MCP at ${base}\n`);
  await testHealth();
  await testCorsPreflight();
  const sessionId = await testInitialize();
  if (sessionId) await testSession(sessionId);
  await testStaleSession();

  console.log('');
  if (failures.length) {
    console.error(`${failures.length} test(s) failed.`);
    process.exit(1);
  }
  console.log('All tests passed — Cursor should be able to connect.');
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
