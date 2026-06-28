import { useEffect, useState } from "react";
import { Deck } from "@agent-deck/shared";

const STORAGE_KEY = "agent-deck-editing-deck-id";

export function useEditingDeck(decks: Deck[]) {
  const [editingDeckId, setEditingDeckIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return localStorage.getItem(STORAGE_KEY);
  });

  useEffect(() => {
    if (decks.length === 0) {
      return;
    }

    const stillValid = editingDeckId && decks.some((deck) => deck.id === editingDeckId);
    if (!stillValid) {
      const nextId = decks[0].id;
      setEditingDeckIdState(nextId);
      localStorage.setItem(STORAGE_KEY, nextId);
    }
  }, [decks, editingDeckId]);

  const setEditingDeckId = (deckId: string) => {
    setEditingDeckIdState(deckId);
    localStorage.setItem(STORAGE_KEY, deckId);
  };

  const editingDeck = decks.find((deck) => deck.id === editingDeckId) ?? null;

  return {
    editingDeck,
    editingDeckId,
    setEditingDeckId,
  };
}
