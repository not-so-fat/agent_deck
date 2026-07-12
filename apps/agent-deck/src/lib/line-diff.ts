import { diffLines } from "diff";

export type DiffRowKind = "unchanged" | "added" | "removed" | "ellipsis";

export type DiffRow = {
  kind: DiffRowKind;
  text: string;
  oldLine?: number;
  newLine?: number;
};

const CONTEXT_LINES = 3;
const COLLAPSE_THRESHOLD = 10;

function splitDiffLines(value: string): string[] {
  if (value === "") return [];
  return value.replace(/\n$/, "").split("\n");
}

export function buildUnifiedDiffRows(before: string, after: string): DiffRow[] {
  const changes = diffLines(before, after);
  const rows: DiffRow[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (const change of changes) {
    const lines = splitDiffLines(change.value);
    const isUnchanged = !change.added && !change.removed;

    if (isUnchanged && lines.length >= COLLAPSE_THRESHOLD) {
      const head = lines.slice(0, CONTEXT_LINES);
      const tail = lines.slice(-CONTEXT_LINES);
      const hidden = lines.length - CONTEXT_LINES * 2;

      for (const line of head) {
        rows.push({ kind: "unchanged", text: line, oldLine: oldLine++, newLine: newLine++ });
      }
      if (hidden > 0) {
        rows.push({ kind: "ellipsis", text: `${hidden} unchanged lines` });
        oldLine += hidden;
        newLine += hidden;
      }
      for (const line of tail) {
        rows.push({ kind: "unchanged", text: line, oldLine: oldLine++, newLine: newLine++ });
      }
      continue;
    }

    for (const line of lines) {
      if (change.added) {
        rows.push({ kind: "added", text: line, newLine: newLine++ });
      } else if (change.removed) {
        rows.push({ kind: "removed", text: line, oldLine: oldLine++ });
      } else {
        rows.push({ kind: "unchanged", text: line, oldLine: oldLine++, newLine: newLine++ });
      }
    }
  }

  return rows;
}

export function hasDiffRows(rows: DiffRow[]): boolean {
  return rows.some((row) => row.kind === "added" || row.kind === "removed");
}
