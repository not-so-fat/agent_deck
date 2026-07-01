import { describe, expect, it } from 'vitest';

import {
  classifyMcpErrorCode,
  extractMcpErrorMessage,
  formatMcpConnectionError,
  resolveMcpErrorMessage,
  shouldAttemptLegacySseFallback,
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
      'Failed to connect to MCP service: Streamable HTTP connection closed',
    );
  });

  it('surfaces streamable-only failure without legacy SSE attempt', () => {
    const streamable = new Error('Streamable HTTP error: Unexpected content type: application/json');

    expect(formatMcpConnectionError(streamable, null)).toBe(
      'Failed to connect to MCP service: Streamable HTTP error: Unexpected content type: application/json',
    );
  });
});

describe('shouldAttemptLegacySseFallback', () => {
  it('returns false for streamable HTTP transport errors', () => {
    expect(shouldAttemptLegacySseFallback(new Error('Streamable HTTP error: Unexpected content type: text/html'))).toBe(false);
  });

  it('returns false for JSON-RPC server errors', () => {
    const err = new Error(
      'Error POSTing to endpoint (HTTP 400): {"jsonrpc":"2.0","error":{"message":"bad token"}}',
    );
    expect(shouldAttemptLegacySseFallback(err)).toBe(false);
  });

  it('returns true for ambiguous legacy endpoint failures', () => {
    expect(shouldAttemptLegacySseFallback(new Error('fetch failed'))).toBe(true);
  });
});

describe('extractMcpErrorMessage', () => {
  it('extracts plain JSON message bodies (e.g. Docmost 401)', () => {
    const err = new Error(
      'Error POSTing to endpoint (HTTP 401): {"message":"Unauthorized","statusCode":401}',
    );
    expect(extractMcpErrorMessage(err)).toBe('Unauthorized');
    expect(shouldAttemptLegacySseFallback(err)).toBe(false);
  });

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
