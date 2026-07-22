import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import type { FeedbackSignal, PlaybookPatch } from "@agent-deck/shared";
import { patchPreviewHasChanges } from "@/lib/patch-preview";
import {
  acceptPlaybookPatch,
  formatPatchDeckNames,
  getPlaybookPatchPreview,
  listPlaybookPatches,
  rejectPlaybookPatch,
} from "@/lib/playbook-patches";
import {
  buildCurationPromptForAgent,
  discardFeedbackSignals,
  getFeedbackSignalCount,
  listFeedbackSignals,
} from "@/lib/feedback-signals";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { PlaybookPatchDiff } from "@/components/playbook-patch-diff";
import {
  PlaybookPatchTriggerConflicts,
  parseTriggerConflicts,
} from "@/components/playbook-patch-trigger-conflicts";
import { ArrowLeft, Copy, Trash2 } from "lucide-react";

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

function FeedbackBacklogPanel({
  signals,
  isLoading,
}: {
  signals: FeedbackSignal[];
  isLoading: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const discardMutation = useMutation({
    mutationFn: (ids: string[]) => discardFeedbackSignals(ids),
    onSuccess: (result) => {
      toast({ title: `Discarded ${result.discarded} signal(s)` });
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: ["/api/feedback-signals"] });
    },
    onError: (error: Error) => {
      toast({ title: "Discard failed", description: error.message, variant: "destructive" });
    },
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyForAgent = async () => {
    const chosen =
      selected.size > 0 ? signals.filter((s) => selected.has(s.id)) : signals;
    if (chosen.length === 0) return;
    try {
      await navigator.clipboard.writeText(buildCurationPromptForAgent(chosen));
      toast({
        title: "Copied curation prompt",
        description: "Paste into your IDE agent chat to propose consolidated patches.",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: error instanceof Error ? error.message : "Clipboard unavailable",
        variant: "destructive",
      });
    }
  };

  return (
    <section className="min-w-0 border-t border-gray-800 pt-6 lg:col-span-2">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-medium text-gray-400">Unreviewed feedback</h2>
        <Badge variant="outline">{signals.length}</Badge>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={signals.length === 0}
            onClick={() => void copyForAgent()}
          >
            <Copy className="mr-1 h-3.5 w-3.5" />
            Copy for agent
            {selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={selected.size === 0 || discardMutation.isPending}
            onClick={() => discardMutation.mutate([...selected])}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Discard selected
          </Button>
        </div>
      </div>
      <p className="mb-3 text-xs text-gray-500">
        Capture happens via MCP during sessions. Bulk curation starts here — copy a prompt for your
        IDE agent, or discard noise.
      </p>
      {isLoading && <p className="text-sm text-gray-500">Loading signals…</p>}
      {!isLoading && signals.length === 0 && (
        <p className="text-sm text-gray-500">No unreviewed signals.</p>
      )}
      <ul className="space-y-2">
        {signals.map((signal) => (
          <li
            key={signal.id}
            className="flex gap-3 rounded-lg border border-gray-800 bg-gray-900/50 p-3"
          >
            <input
              type="checkbox"
              className="mt-1"
              checked={selected.has(signal.id)}
              onChange={() => toggle(signal.id)}
              aria-label={`Select ${signal.id}`}
            />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs text-gray-600">{signal.id}</p>
              <p className="mt-1 text-sm text-gray-200">&ldquo;{signal.userFeedbackExcerpt}&rdquo;</p>
              <p className="mt-1 text-sm text-gray-400">{signal.failureSummary}</p>
              <p className="mt-1 text-xs text-gray-600">
                {signal.candidatePlaybookId ?? "no playbook"}
                {signal.candidateDeckId ? ` · deck ${signal.candidateDeckId.slice(0, 8)}…` : ""}
                {" · "}
                {new Date(signal.createdAt).toLocaleString()}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
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

  const { data: unreviewedCount = 0 } = useQuery({
    queryKey: ["/api/feedback-signals/count", "unreviewed"],
    queryFn: () => getFeedbackSignalCount(),
  });

  const { data: unreviewedSignals = [], isLoading: signalsLoading } = useQuery({
    queryKey: ["/api/feedback-signals", "unreviewed"],
    queryFn: () => listFeedbackSignals({ status: "unreviewed" }),
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
      void queryClient.invalidateQueries({ queryKey: ["/api/feedback-signals"] });
    },
    onError: (error: Error) => {
      toast({ title: "Reject failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="flex min-h-dvh flex-col bg-gray-950 text-gray-100">
      <header className="shrink-0 border-b border-gray-800 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-gray-300">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Deck
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Playbook review queue</h1>
          <Badge variant="secondary">{patches.length} proposed</Badge>
          {unreviewedCount > 0 && (
            <Badge variant="outline">{unreviewedCount} unreviewed signals</Badge>
          )}
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:min-h-0 lg:grid-cols-[minmax(18rem,20rem)_minmax(0,1fr)] lg:items-stretch lg:overflow-hidden">
        <section className="min-w-0 lg:min-h-0 lg:overflow-y-auto">
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
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block font-medium leading-snug">
                        {patch.kind === "create" ? `New: ${patch.displayTitle}` : patch.displayTitle}
                      </span>
                      {patch.playbookId && patch.kind !== "create" && (
                        <span className="mt-0.5 block truncate font-mono text-xs text-gray-600">
                          {patch.playbookId}
                        </span>
                      )}
                      {formatPatchDeckNames(patch.deckNames) && (
                        <span className="mt-1 block text-xs text-gray-500">
                          Decks: {formatPatchDeckNames(patch.deckNames)}
                        </span>
                      )}
                    </div>
                    <Badge variant="outline" className="shrink-0">{patch.kind}</Badge>
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

        <section className="flex min-w-0 flex-col lg:min-h-0 lg:flex-1 lg:overflow-hidden">
          <h2 className="mb-3 shrink-0 text-sm font-medium text-gray-400">Detail</h2>
          {!selected && (
            <p className="text-sm text-gray-500">Select a proposal to preview the diff.</p>
          )}
          {selected && (
            <div className="flex flex-col overflow-hidden rounded-lg border border-gray-800 bg-gray-900/50 lg:min-h-0 lg:flex-1">
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
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
                  {(() => {
                    const storedConflicts = parseTriggerConflicts(selected.conflictsJson);
                    const previewConflicts = preview?.trigger_conflicts ?? [];
                    const conflicts =
                      previewConflicts.length > 0 ? previewConflicts : storedConflicts;
                    return <PlaybookPatchTriggerConflicts conflicts={conflicts} />;
                  })()}
                  {previewLoading && <p className="text-sm text-gray-500">Loading preview…</p>}
                  {previewError && (
                    <div className="rounded-md border border-rose-500/50 bg-rose-500/10 p-3 text-sm text-rose-100">
                      Preview failed —{" "}
                      {previewErrorDetail?.message ?? "could not apply ops to the current playbook."}{" "}
                      Reject and re-propose with exact list anchors or <code>rewrite_body</code>.
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

              <div className="relative z-10 shrink-0 space-y-4 border-t border-gray-800 bg-gray-950 p-4 shadow-[0_-16px_32px_rgba(0,0,0,0.55)] sm:p-5">
                <h3 className="text-sm font-medium text-gray-400">Your decision</h3>
                <Button
                  variant="gold"
                  className="w-full sm:w-auto"
                  onClick={() => acceptMutation.mutate(selected.id)}
                  disabled={acceptMutation.isPending || previewError || !previewHasChanges}
                >
                  Accept
                </Button>
                <div className="space-y-2 rounded-md border border-gray-800 bg-gray-900/80 p-3">
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

        <FeedbackBacklogPanel signals={unreviewedSignals} isLoading={signalsLoading} />
      </main>
    </div>
  );
}
