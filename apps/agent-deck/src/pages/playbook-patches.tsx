import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import type { PatchPreview, PlaybookPatch } from "@agent-deck/shared";
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

function DiffPanel({ preview }: { preview: PatchPreview }) {
  const rewrite =
    preview.before.body.trim() !== preview.after.body.trim() &&
    preview.after.body.length > 0 &&
    !preview.after.body.includes(preview.before.body.slice(0, 40));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rewrite && (
        <div className="md:col-span-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-100">
          Full-body rewrite proposed — review carefully.
        </div>
      )}
      <div>
        <h4 className="mb-2 text-sm font-medium text-gray-400">Before</h4>
        <pre className="max-h-64 overflow-auto rounded-md bg-gray-900 p-3 text-xs text-gray-200 whitespace-pre-wrap">
          {preview.before.body || "(empty)"}
        </pre>
        {preview.before.triggers.length > 0 && (
          <p className="mt-2 text-xs text-gray-500">
            Triggers: {preview.before.triggers.join(", ")}
          </p>
        )}
      </div>
      <div>
        <h4 className="mb-2 text-sm font-medium text-gray-400">After</h4>
        <pre className="max-h-64 overflow-auto rounded-md bg-gray-900 p-3 text-xs text-green-100 whitespace-pre-wrap">
          {preview.after.body || "(empty)"}
        </pre>
        {preview.after.triggers.length > 0 && (
          <p className="mt-2 text-xs text-gray-500">
            Triggers: {preview.after.triggers.join(", ")}
          </p>
        )}
      </div>
    </div>
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

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ["/api/playbook-patches", selectedId, "preview"],
    queryFn: () => getPlaybookPatchPreview(selectedId!),
    enabled: Boolean(selectedId),
  });

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
        <div className="mx-auto flex max-w-5xl items-center gap-3">
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

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-2">
        <section>
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

        <section>
          <h2 className="mb-3 text-sm font-medium text-gray-400">Detail</h2>
          {!selected && (
            <p className="text-sm text-gray-500">Select a proposal to preview the diff.</p>
          )}
          {selected && (
            <div className="space-y-4 rounded-lg border border-gray-800 bg-gray-900/50 p-4">
              <p className="text-sm text-gray-300">{selected.rationale}</p>
              {(() => {
                const evidence = parseEvidence(selected);
                if (!evidence) return null;
                return (
                  <div className="rounded-md border border-gray-700 bg-gray-950 p-3 text-sm">
                    <p className="text-xs font-medium uppercase text-gray-500">Your correction</p>
                    <p className="mt-1 italic text-gray-200">
                      &ldquo;{evidence.user_feedback_excerpt}&rdquo;
                    </p>
                    {evidence.failure_summary && (
                      <p className="mt-2 text-gray-400">{evidence.failure_summary}</p>
                    )}
                  </div>
                );
              })()}
              {previewLoading && <p className="text-sm text-gray-500">Loading preview…</p>}
              {preview && <DiffPanel preview={preview} />}
              {selected.status === "stale" && (
                <p className="text-sm text-amber-400">
                  Stale — playbook changed since proposal. Re-propose from a fresh session.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => acceptMutation.mutate(selected.id)}
                  disabled={acceptMutation.isPending}
                >
                  Accept
                </Button>
              </div>
              <div className="space-y-2 border-t border-gray-800 pt-4">
                <Textarea
                  placeholder="Rejection reason (required)"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="min-h-[72px] bg-gray-950"
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
          )}
        </section>
      </main>
    </div>
  );
}
