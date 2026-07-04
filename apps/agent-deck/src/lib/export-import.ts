import type { BundleV1, ImportReport } from "@agent-deck/shared";
import { apiRequest } from "@/lib/queryClient";

export async function exportBundle(request: {
  scope?: "collection" | "deck";
  deckId?: string;
}): Promise<BundleV1> {
  const response = await apiRequest("POST", "/api/export", {
    scope: request.scope ?? "collection",
    ...(request.deckId ? { deckId: request.deckId } : {}),
  });
  const body = (await response.json()) as { success: boolean; data: BundleV1 };
  return body.data;
}

export async function importBundlePayload(bundle: unknown): Promise<ImportReport> {
  const response = await apiRequest("POST", "/api/import", bundle);
  const body = (await response.json()) as { success: boolean; data: ImportReport };
  return body.data;
}

export function downloadBundleJson(bundle: BundleV1, filename: string): void {
  const blob = new Blob([`${JSON.stringify(bundle, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function safeFilename(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "deck";
}

export function formatImportSummary(report: ImportReport): string {
  const { services, playbooks, decks } = report.counts;
  return `Decks +${decks.created} / skipped ${decks.reused}. Services +${services.created} / skipped ${services.reused}. Playbooks +${playbooks.created} / skipped ${playbooks.reused}.`;
}
