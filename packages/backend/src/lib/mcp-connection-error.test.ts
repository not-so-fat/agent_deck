import { describe, expect, it } from 'vitest';

import {
  classifyMcpErrorCode,
  extractMcpErrorMessage,
  formatMcpConnectionError,
  resolveMcpErrorMessage,
} from './mcp-connection-error';

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

  it('surfaces SSE content-type mismatch from legacy transport fallback', () => {
    const streamable = new Error('Streamable HTTP connection closed');
    const sse = new Error('SSE error: Invalid content type, expected "text/event-stream"');

    expect(formatMcpConnectionError(streamable, sse)).toBe(
      'Failed to connect to MCP service: SSE error: Invalid content type, expected "text/event-stream"',
    );
  });
});

describe('extractMcpErrorMessage', () => {
  it('returns null for generic transport errors', () => {
    expect(extractMcpErrorMessage(new Error('SSE error: Non-200 status code (401)'))).toBeNull();
  });
});

describe('resolveMcpErrorMessage', () => {
  it('prefers parsed JSON-RPC messages', () => {
    const err = new Error(
      'Error POSTing to endpoint (HTTP 400): {"jsonrpc":"2.0","error":{"message":"Token expired"}}',
    );
    expect(resolveMcpErrorMessage(err)).toBe('Token expired');
  });

  it('falls back to Error.message', () => {
    expect(resolveMcpErrorMessage(new Error('SSE error: Invalid content type'))).toBe(
      'SSE error: Invalid content type',
    );
  });
});

describe('classifyMcpErrorCode', () => {
  it('classifies transport errors', () => {
    expect(classifyMcpErrorCode('SSE error: Invalid content type, expected "text/event-stream"')).toBe(
      'MCP_TRANSPORT_ERROR',
    );
  });

  it('classifies auth errors', () => {
    expect(classifyMcpErrorCode('UnauthorizedError: token expired')).toBe('MCP_AUTH_ERROR');
  });
});
