export type McpErrorCode =
  | 'MCP_TRANSPORT_ERROR'
  | 'MCP_AUTH_ERROR'
  | 'MCP_TOOL_ERROR'
  | 'MCP_CONNECTION_ERROR';

export interface ServiceToolErrorDetails {
  service_id: string;
  service_name: string;
  remote_url: string;
  tool_name?: string;
  cause: string;
  phase: 'connect' | 'discoverTools' | 'callTool';
}

/** Extract a user-facing message from MCP client connection failures. */
export function formatMcpConnectionError(
  streamableError: unknown,
  sseError: unknown,
): string {
  for (const err of [streamableError, sseError]) {
    const parsed = extractMcpErrorMessage(err);
    if (parsed) {
      return parsed;
    }
  }

  const sseMsg = sseError instanceof Error ? sseError.message : String(sseError ?? '');
  if (sseMsg && !sseMsg.includes('Non-200 status code')) {
    return `Failed to connect to MCP service: ${sseMsg}`;
  }

  return 'Failed to connect to MCP service';
}

export function extractMcpErrorMessage(err: unknown): string | null {
  return parseMcpErrorMessage(err);
}

/** Resolve the best user-facing message from any MCP-related failure. */
export function resolveMcpErrorMessage(err: unknown): string {
  const parsed = extractMcpErrorMessage(err);
  if (parsed) {
    return parsed;
  }

  if (err instanceof Error && err.message.trim()) {
    return err.message.trim();
  }

  const raw = String(err ?? '').trim();
  return raw || 'Failed to call tool';
}

export function classifyMcpErrorCode(message: string): McpErrorCode {
  const lower = message.toLowerCase();

  if (
    lower.includes('unauthorized')
    || lower.includes('401')
    || lower.includes('403')
    || lower.includes('token')
    || lower.includes('app is not enabled')
    || lower.includes('authentication')
  ) {
    return 'MCP_AUTH_ERROR';
  }

  if (
    lower.includes('content type')
    || lower.includes('text/event-stream')
    || lower.includes('sse error')
    || lower.includes('econnrefused')
    || lower.includes('enotfound')
    || lower.includes('etimedout')
    || lower.includes('fetch failed')
    || lower.includes('network')
  ) {
    return 'MCP_TRANSPORT_ERROR';
  }

  if (lower.includes('failed to connect to mcp service')) {
    return 'MCP_CONNECTION_ERROR';
  }

  return 'MCP_TOOL_ERROR';
}

function parseMcpErrorMessage(err: unknown): string | null {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  if (!raw) {
    return null;
  }

  const jsonStart = raw.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const payload = JSON.parse(raw.slice(jsonStart)) as {
        error?: { message?: string };
      };
      const message = payload.error?.message?.trim();
      if (message) {
        return message;
      }
    } catch {
      // fall through
    }
  }

  if (raw.includes('App is not enabled for Slack MCP')) {
    return raw.replace(/^Error POSTing to endpoint \(HTTP \d+\): /, '');
  }

  return null;
}
