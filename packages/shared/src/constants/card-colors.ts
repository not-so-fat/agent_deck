/** Fixed playing-card colors by connection type. */
export const MCP_CARD_COLOR = '#92E4DD';
export const API_KEY_CARD_COLOR = '#F9386D';
export const PLAYBOOK_CARD_COLOR = '#FFFFFF';

/** Fixed by connection type — custom per-card colors are not used. */
export function getServiceCardColor(service: { type: string; cardColor?: string | null }): string {
  void service.cardColor;
  return MCP_CARD_COLOR;
}
