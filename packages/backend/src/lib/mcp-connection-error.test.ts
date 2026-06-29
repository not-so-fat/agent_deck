import { describe, expect, it } from 'vitest';

import { extractMcpErrorMessage, formatMcpConnectionError } from './mcp-connection-error';

describe('formatMcpConnectionError', () => {
  it('extracts Slack MCP enable message from streamable HTTP error', () => {
    const streamable = new Error(
      'Error POSTing to endpoint (HTTP 400): {"jsonrpc":"2.0","id":null,"error":{"code":-32600,"message":"App is not enabled for Slack MCP server access. Please enable it here: https://api.slack.com/apps/ABC/app-assistant"}}',
    );
    const sse = new Error('SSE error: Non-200 status code (401)');

    expect(formatMcpConnectionError(streamable, sse)).toBe(
      'App is not enabled for Slack MCP server access. Please enable it here: https://api.slack.com/apps/ABC/app-assistant',
    );
  });
});

describe('extractMcpErrorMessage', () => {
  it('returns null for generic transport errors', () => {
    expect(extractMcpErrorMessage(new Error('SSE error: Non-200 status code (401)'))).toBeNull();
  });
});
