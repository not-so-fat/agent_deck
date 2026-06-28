/** Fixed playing-card colors by connection type. */
export const MCP_CARD_COLOR = '#92E4DD';
export const API_KEY_CARD_COLOR = '#F9386D';
export const PLAYBOOK_CARD_COLOR = '#FFFFFF';

export function getServiceCardColor(service: { type: string; cardColor?: string | null }): string {
  if (service.type === 'mcp' || service.type === 'local-mcp') {
    return MCP_CARD_COLOR;
  }
  return service.cardColor ?? MCP_CARD_COLOR;
}
