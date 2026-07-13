import type { DatabaseManager } from '../models/database';
import type { Deck } from '@agent-deck/shared';

/** Resolve a deck by UUID id or exact name (case-insensitive). Returns null if ambiguous or missing. */
export async function resolveDeckRef(
  db: DatabaseManager,
  ref: string,
): Promise<Deck | null> {
  const trimmed = ref.trim();
  if (!trimmed) {
    return null;
  }

  const byId = await db.getDeck(trimmed);
  if (byId) {
    return byId;
  }

  const decks = await db.getAllDecks();
  const lower = trimmed.toLowerCase();
  const byName = decks.filter((deck) => deck.name.toLowerCase() === lower);
  if (byName.length === 1) {
    return byName[0];
  }

  return null;
}
