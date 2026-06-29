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
