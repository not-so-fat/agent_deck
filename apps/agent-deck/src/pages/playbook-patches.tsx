import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import type { PlaybookPatch } from "@agent-deck/shared";
import { patchPreviewHasChanges } from "@/lib/patch-preview";
import {
  acceptPlaybookPatch,
  getPlaybookPatchPreview,
  listPlaybookPatches,
  rejectPlaybookPatch,
} from "@/lib/playbook-patches";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { PlaybookPatchDiff } from "@/components/playbook-patch-diff";
import { ArrowLeft } from "lucide-react";

function parseEvidence(patch: PlaybookPatch) {
  if (!patch.evidenceJson) return null;
  try {
    return JSON.parse(patch.evidenceJson) as {
      failure_summary?: string;
      user_feedback_excerpt?: string;
      corrected_output_hint?: string;
    };
  } catch {
    return null;
  }
}

export default function PlaybookPatchesPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: patches = [], isLoading } = useQuery({
    queryKey: ["/api/playbook-patches", "proposed"],
    queryFn: () => listPlaybookPatches("proposed"),
  });

  const {
    data: preview,
    isLoading: previewLoading,
    isError: previewError,
    error: previewErrorDetail,
  } = useQuery({
    queryKey: ["/api/playbook-patches", selectedId, "preview"],
    queryFn: () => getPlaybookPatchPreview(selectedId!),
    enabled: Boolean(selectedId),
  });

  const previewHasChanges = preview ? patchPreviewHasChanges(preview) : false;

  const selected = patches.find((p) => p.id === selectedId) ?? null;

  const acceptMutation = useMutation({
    mutationFn: (id: string) => acceptPlaybookPatch(id),
    onSuccess: () => {
      toast({ title: "Patch accepted" });
      setSelectedId(null);
      void queryClient.invalidateQueries({ queryKey: ["/api/playbook-patches"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/playbooks"] });
    },
    onError: (error: Error) => {
      toast({ title: "Accept failed", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectPlaybookPatch(id, reason),
    onSuccess: () => {
      toast({ title: "Patch rejected" });
      setSelectedId(null);
      setRejectReason("");
      void queryClient.invalidateQueries({ queryKey: ["/api/playbook-patches"] });
    },
    onError: (error: Error) => {
      toast({ title: "Reject failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="min-h-dvh bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-gray-300">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Deck
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Playbook review queue</h1>
          <Badge variant="secondary">{patches.length} proposed</Badge>
        </div>
      </header>

      <main className="mx-auto grid min-w-0 max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(18rem,20rem)_minmax(0,1fr)] lg:items-start">
        <section className="min-w-0">
          <h2 className="mb-3 text-sm font-medium text-gray-400">Proposals</h2>
          {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {!isLoading && patches.length === 0 && (
            <p className="text-sm text-gray-500">No proposals waiting for review.</p>
          )}
          <ul className="space-y-2">
            {patches.map((patch) => (
              <li key={patch.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(patch.id)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    selectedId === patch.id
                      ? "border-blue-500 bg-gray-900"
                      : "border-gray-800 bg-gray-900/50 hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {patch.kind === "create"
                        ? `NEW: ${JSON.parse(patch.opsJson).title ?? "playbook"}`
                        : patch.playbookId}
                    </span>
                    <Badge variant="outline">{patch.kind}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-400">{patch.rationale}</p>
                  <p className="mt-1 text-xs text-gray-600">
                    {patch.source} · {new Date(patch.createdAt).toLocaleString()}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="min-w-0">
          <h2 className="mb-3 text-sm font-medium text-gray-400">Detail</h2>
          {!selected && (
            <p className="text-sm text-gray-500">Select a proposal to preview the diff.</p>
          )}
          {selected && (
            <div className="flex max-h-[calc(100dvh-8rem)] min-h-0 flex-col overflow-hidden rounded-lg border border-gray-800 bg-gray-900/50">
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                <div className="min-w-0 space-y-4">
                  <p className="text-sm leading-relaxed text-gray-300">{selected.rationale}</p>
                  {(() => {
                    const evidence = parseEvidence(selected);
                    if (!evidence) return null;
                    return (
                      <div className="rounded-md border border-gray-700 bg-gray-950 p-4 text-sm">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                          Your correction
                        </p>
                        <p className="mt-2 italic text-gray-200">
                          &ldquo;{evidence.user_feedback_excerpt}&rdquo;
                        </p>
                        {evidence.failure_summary && (
                          <p className="mt-2 text-gray-400">{evidence.failure_summary}</p>
                        )}
                      </div>
                    );
                  })()}
                  {previewLoading && <p className="text-sm text-gray-500">Loading preview…</p>}
                  {previewError && (
                    <div className="rounded-md border border-rose-500/50 bg-rose-500/10 p-3 text-sm text-rose-100">
                      Preview failed — {previewErrorDetail?.message ?? "could not apply ops to the current playbook."}
                      {" "}Reject and re-propose with exact list anchors or <code>rewrite_body</code>.
                    </div>
                  )}
                  {preview && <PlaybookPatchDiff preview={preview} />}
                  {selected.status === "stale" && (
                    <p className="text-sm text-amber-400">
                      Stale — playbook changed since proposal. Re-propose from a fresh session.
                    </p>
                  )}
                </div>
              </div>

              <div className="shrink-0 space-y-4 border-t border-gray-800 bg-gray-900/95 p-4 backdrop-blur-sm sm:p-5">
                <h3 className="text-sm font-medium text-gray-400">Your decision</h3>
                <Button
                  variant="gold"
                  className="w-full sm:w-auto"
                  onClick={() => acceptMutation.mutate(selected.id)}
                  disabled={acceptMutation.isPending || previewError || !previewHasChanges}
                >
                  Accept
                </Button>
                <div className="space-y-2 rounded-md border border-gray-800 bg-gray-950/60 p-3">
                  <Textarea
                    placeholder="Rejection reason (required)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="min-h-[88px] bg-gray-950"
                  />
                  <Button
                    variant="destructive"
                    disabled={!rejectReason.trim() || rejectMutation.isPending}
                    onClick={() =>
                      rejectMutation.mutate({ id: selected.id, reason: rejectReason.trim() })
                    }
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
