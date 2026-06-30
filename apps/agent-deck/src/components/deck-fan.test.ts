import { describe, expect, it } from "vitest";
import {
  CARD_OVERLAP,
  VISIBLE_CARD_SLOTS,
  deckFanCardZIndex,
  fanContentWidth,
  tiltFromViewportPosition,
  visibleFanWidth,
} from "./deck-fan";

describe("deck fan layout", () => {
  it("keeps a fixed overlap so each card stays readable", () => {
    expect(CARD_OVERLAP).toBe(48);
    expect(fanContentWidth(1, CARD_OVERLAP)).toBe(128);
    expect(fanContentWidth(2, CARD_OVERLAP)).toBe(208);
  });

  it("fits ten cards in the visible window", () => {
    expect(visibleFanWidth).toBe(fanContentWidth(VISIBLE_CARD_SLOTS, CARD_OVERLAP));
    expect(visibleFanWidth).toBe(128 + 9 * 80);
  });

  it("needs edge scroll when the deck has more than ten cards", () => {
    const tenCards = fanContentWidth(10, CARD_OVERLAP);
    const twentyOneCards = fanContentWidth(21, CARD_OVERLAP);
    expect(twentyOneCards).toBeGreaterThan(tenCards);
  });
});

describe("deckFanCardZIndex", () => {
  it("lifts hovered card above the fan", () => {
    expect(deckFanCardZIndex(3, 10, 3)).toBe(999999);
    expect(deckFanCardZIndex(3, 10, null)).toBe(7);
  });
});

describe("tiltFromViewportPosition", () => {
  it("is straight at the viewport center", () => {
    expect(tiltFromViewportPosition(500, 400, 200)).toBe(0);
  });

  it("tilts left near the left edge", () => {
    expect(tiltFromViewportPosition(400, 400, 200)).toBeLessThan(0);
  });

  it("tilts right near the right edge", () => {
    expect(tiltFromViewportPosition(600, 400, 200)).toBeGreaterThan(0);
  });
});
