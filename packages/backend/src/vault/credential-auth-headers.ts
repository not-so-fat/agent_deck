import type { Credential } from '@agent-deck/shared';

/** Map a deck credential secret to HTTP headers for outbound MCP/API calls. */
export function buildCredentialAuthHeaders(
  credential: Pick<Credential, 'scheme' | 'headerName'>,
  secret: string,
): Record<string, string> {
  switch (credential.scheme) {
    case 'bearer':
      return { Authorization: `Bearer ${secret}` };
    case 'header':
      if (!credential.headerName?.trim()) {
        throw new Error(`Credential ${credential.scheme} requires headerName`);
      }
      return { [credential.headerName.trim()]: secret };
    case 'http_basic_user':
      return {
        Authorization: `Basic ${Buffer.from(`${secret}:`, 'utf8').toString('base64')}`,
      };
    default:
      throw new Error(`Unsupported credential scheme: ${credential.scheme satisfies never}`);
  }
}
