import { describe, expect, it } from "vitest";
import { buildUnifiedDiffRows, hasDiffRows } from "./line-diff";

describe("buildUnifiedDiffRows", () => {
  it("highlights a single line change", () => {
    const rows = buildUnifiedDiffRows("alpha\nbeta\ngamma", "alpha\nBETA\ngamma");
    expect(rows.some((row) => row.kind === "removed" && row.text === "beta")).toBe(true);
    expect(rows.some((row) => row.kind === "added" && row.text === "BETA")).toBe(true);
    expect(hasDiffRows(rows)).toBe(true);
  });

  it("treats a new playbook body as all additions", () => {
    const rows = buildUnifiedDiffRows("", "# Title\n\nBody");
    expect(rows.every((row) => row.kind === "added")).toBe(true);
    expect(rows[0]?.newLine).toBe(1);
  });

  it("collapses long unchanged regions", () => {
    const unchanged = Array.from({ length: 12 }, (_, index) => `line ${index + 1}`).join("\n");
    const before = `${unchanged}\nold tail`;
    const after = `${unchanged}\nnew tail`;

    const rows = buildUnifiedDiffRows(before, after);
    expect(rows.some((row) => row.kind === "ellipsis")).toBe(true);
    expect(rows.some((row) => row.kind === "removed" && row.text === "old tail")).toBe(true);
    expect(rows.some((row) => row.kind === "added" && row.text === "new tail")).toBe(true);
  });
});
