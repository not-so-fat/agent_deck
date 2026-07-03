/** Activity age for live session rows — mirrors menubar CLI formatting. */
export function formatActivityAge(lastActivityAt: string, now: Date): string {
  const then = new Date(lastActivityAt).getTime();
  if (Number.isNaN(then)) {
    return '';
  }
  const seconds = Math.max(0, Math.floor((now.getTime() - then) / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  return `${Math.floor(hours / 24)}d`;
}

export function truncateDeckName(name: string, max = 24): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

export function workspaceBasename(workspaceRoot: string): string {
  const trimmed = workspaceRoot.replace(/\/+$/, '');
  const slash = trimmed.lastIndexOf('/');
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

/** Live MCP session count per deck id (from GET /api/scope/bindings). */
export function countSessionsByDeckId(
  bindings: Array<{ deckId: string }>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of bindings) {
    counts.set(row.deckId, (counts.get(row.deckId) ?? 0) + 1);
  }
  return counts;
}

/** Subtitle under deck name in My Decks — cards plus optional live session count. */
export function formatDeckListSubtitle(cardCount: number, sessionCount: number): string {
  const cards = cardCount > 0 ? `${cardCount} cards` : 'Empty';
  if (sessionCount <= 0) {
    return cards;
  }
  const sessions =
    sessionCount === 1 ? '1 session' : `${sessionCount} sessions`;
  return `${cards}, ${sessions}`;
}
