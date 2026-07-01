import { z } from 'zod';

export const DeckDisplaySourceSchema = z.enum([
  'session_override',
  'repo_manifest',
  'env',
  'unbound',
]);

export const DeckCardCountsSchema = z.object({
  mcp: z.number().int().min(0),
  credentials: z.number().int().min(0),
  playbooks: z.number().int().min(0),
});

export const BindingEntrySchema = z.object({
  deckId: z.string().uuid(),
  deckName: z.string(),
  source: z.enum(['session_override', 'repo_manifest', 'env']),
  updatedAt: z.string().datetime(),
  cardCounts: DeckCardCountsSchema,
  oauthWarningCount: z.number().int().min(0).optional(),
});

/** Keys are absolute workspace root paths. */
export const BindingsFileSchema = z.record(z.string(), BindingEntrySchema);

export const DeckDisplaySchema = z.object({
  workspaceRoot: z.string(),
  deckId: z.string().uuid().nullable(),
  deckName: z.string().nullable(),
  source: DeckDisplaySourceSchema,
  cardCounts: DeckCardCountsSchema,
  oauthWarningCount: z.number().int().min(0).optional(),
  agentDeckOnline: z.boolean(),
  displayLine: z.string(),
});

export const StatusLinePayloadSchema = z.object({
  cwd: z.string().optional(),
  workspace: z
    .object({
      current_dir: z.string().optional(),
    })
    .optional(),
});

export type DeckDisplaySource = z.infer<typeof DeckDisplaySourceSchema>;
export type DeckCardCounts = z.infer<typeof DeckCardCountsSchema>;
export type BindingEntry = z.infer<typeof BindingEntrySchema>;
export type BindingsFile = z.infer<typeof BindingsFileSchema>;
export type DeckDisplay = z.infer<typeof DeckDisplaySchema>;
export type StatusLinePayload = z.infer<typeof StatusLinePayloadSchema>;

export const DISPLAY_LINE_MAX_LENGTH = 120;

export function countDeckCards(deck: {
  services?: Array<{ type?: string }>;
  credentials?: unknown[];
  playbooks?: unknown[];
}): DeckCardCounts {
  const services = deck.services ?? [];
  return {
    mcp: services.filter((service) => service.type === 'mcp').length,
    credentials: deck.credentials?.length ?? 0,
    playbooks: deck.playbooks?.length ?? 0,
  };
}

export function formatDisplayLine(
  deckName: string | null,
  counts: DeckCardCounts,
  options?: { offline?: boolean },
): string {
  const prefix = '◆ ';

  if (options?.offline) {
    return `${prefix}Agent Deck offline`;
  }

  if (!deckName) {
    return `${prefix}—`;
  }

  const countsPart = `${counts.mcp} MCP · ${counts.credentials} keys · ${counts.playbooks} playbooks`;
  const separator = ' · ';
  const fixedLength = prefix.length + separator.length + countsPart.length;
  const maxNameLength = DISPLAY_LINE_MAX_LENGTH - fixedLength;

  let name = deckName;
  if (maxNameLength < 1) {
    return `${prefix}${countsPart}`.slice(0, DISPLAY_LINE_MAX_LENGTH);
  }
  if (name.length > maxNameLength) {
    name = `${name.slice(0, Math.max(1, maxNameLength - 1))}…`;
  }

  const line = `${prefix}${name}${separator}${countsPart}`;
  return line.length > DISPLAY_LINE_MAX_LENGTH ? line.slice(0, DISPLAY_LINE_MAX_LENGTH) : line;
}

export function resolveStatusLineWorkspace(payload: StatusLinePayload, fallbackCwd?: string): string | undefined {
  const cwd = payload.cwd?.trim() || payload.workspace?.current_dir?.trim() || fallbackCwd?.trim();
  return cwd || undefined;
}
