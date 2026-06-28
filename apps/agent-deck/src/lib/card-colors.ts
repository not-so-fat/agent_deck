/** Keep in sync with @agent-deck/shared constants/card-colors.ts */
export const MCP_CARD_COLOR = "#39FF14";
export const API_KEY_CARD_COLOR = "#F9386D";
export const PLAYBOOK_CARD_COLOR = "#FFFFFF";

/** Dark face used on playing cards — reuse on register buttons. */
export const CARD_FACE_CLASS =
  "bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900";

export function getServiceCardColor(service: { type: string; cardColor?: string | null }): string {
  if (service.type === "mcp" || service.type === "local-mcp") {
    return MCP_CARD_COLOR;
  }
  return service.cardColor ?? MCP_CARD_COLOR;
}

/** Border + label color matching a card accent; face comes from CARD_FACE_CLASS. */
export function cardAccentStyle(accent: string): {
  borderColor: string;
  color: string;
  boxShadow: string;
} {
  return {
    borderColor: accent,
    color: accent,
    boxShadow: `0 0 20px ${accent}20`,
  };
}
