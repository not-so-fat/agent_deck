import { describe, expect, it } from "vitest";
import {
  isLongToolDescription,
  stripMarkdownInline,
  toolDescriptionSummary,
} from "./tool-description";

describe("toolDescriptionSummary", () => {
  it("prefers MCP title when present", () => {
    expect(
      toolDescriptionSummary("Long agent-facing prompt with **markdown**.", "Create diagram"),
    ).toBe("Create diagram");
  });

  it("strips inline markdown from the first paragraph", () => {
    expect(
      toolDescriptionSummary("**Use Mermaid** when the user asks for `flowchart` diagrams."),
    ).toBe("Use Mermaid when the user asks for flowchart diagrams.");
  });

  it("truncates long descriptions without a title", () => {
    const long = "A".repeat(200);
    const summary = toolDescriptionSummary(long);
    expect(summary.length).toBeLessThanOrEqual(180);
    expect(summary.endsWith("…")).toBe(true);
  });
});

describe("isLongToolDescription", () => {
  it("treats multiline descriptions as long", () => {
    expect(isLongToolDescription("Line one\nLine two")).toBe(true);
  });

  it("treats title + long body as long", () => {
    expect(isLongToolDescription("x".repeat(200), "Short title")).toBe(true);
  });

  it("treats short single-line descriptions as compact", () => {
    expect(isLongToolDescription("List all decks.")).toBe(false);
  });
});

describe("stripMarkdownInline", () => {
  it("removes bold and code markers", () => {
    expect(stripMarkdownInline("**Bold** and `code`")).toBe("Bold and code");
  });
});
