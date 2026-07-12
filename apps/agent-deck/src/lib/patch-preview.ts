import type { PatchPreview } from "@agent-deck/shared";

export function patchPreviewHasChanges(preview: PatchPreview): boolean {
  return (
    preview.before.title !== preview.after.title ||
    preview.before.body !== preview.after.body ||
    preview.before.triggers.join("\n") !== preview.after.triggers.join("\n")
  );
}
