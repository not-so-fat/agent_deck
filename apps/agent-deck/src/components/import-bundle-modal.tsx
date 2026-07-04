import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ImportReport } from "@agent-deck/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatImportSummary, importBundlePayload } from "@/lib/export-import";

interface ImportBundleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ImportBundleModal({
  open,
  onOpenChange,
}: ImportBundleModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [showIdMap, setShowIdMap] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const reset = () => {
    setFile(null);
    setPreview(null);
    setReport(null);
    setShowIdMap(false);
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file) {
        throw new Error("Choose a bundle file first");
      }
      const text = await file.text();
      let bundle: unknown;
      try {
        bundle = JSON.parse(text);
      } catch {
        throw new Error("File is not valid JSON");
      }
      return importBundlePayload(bundle);
    },
    onSuccess: (data) => {
      setReport(data);
      queryClient.invalidateQueries({ queryKey: ["/api/decks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/playbooks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/playbooks/collection"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credentials/collection"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collection/warnings"] });
      toast({
        title: "Import complete",
        description: formatImportSummary(data),
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onFileChange = async (next: File | null) => {
    setFile(next);
    setReport(null);
    if (!next) {
      setPreview(null);
      return;
    }
    try {
      const text = await next.text();
      const bundle = JSON.parse(text) as {
        services?: unknown[];
        playbooks?: unknown[];
        decks?: unknown[];
      };
      setPreview(
        `${bundle.services?.length ?? 0} services · ${bundle.playbooks?.length ?? 0} playbooks · ${bundle.decks?.length ?? 0} decks`,
      );
    } catch {
      setPreview("Invalid JSON");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg border-border bg-[#161612] text-[#E8F6F4]">
        <DialogHeader>
          <DialogTitle>Import bundle</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-left text-sm text-[#A8C4C0]">
              <p>Adds MCP, playbooks, and decks from a JSON file.</p>
              <div>
                <p className="font-medium text-amber-200/90">Notes</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  <li>Same name as an existing card or deck is skipped (linked only).</li>
                  <li>No credentials or secrets — re-enter keys and reconnect OAuth.</li>
                </ul>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bundle-file">Bundle file</Label>
            <Input
              id="bundle-file"
              type="file"
              accept=".json,.agent-deck.json,application/json"
              className="cursor-pointer bg-white/5 border-white/20"
              onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
              data-testid="input-import-bundle"
            />
            {preview && (
              <p className="text-xs text-[#A8C4C0]" data-testid="import-preview">
                {preview}
              </p>
            )}
          </div>

          {!report && (
            <Button
              onClick={() => importMutation.mutate()}
              disabled={!file || importMutation.isPending || preview === "Invalid JSON"}
              className="rounded-full border px-6 text-sm font-semibold hover:opacity-90"
              style={{
                background: "#C4B643",
                borderColor: "#C4B643",
                color: "black",
              }}
              data-testid="button-import-apply"
            >
              {importMutation.isPending ? "Importing…" : "Import"}
            </Button>
          )}

          {report && (
            <div
              className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3 text-sm"
              data-testid="import-report"
            >
              <p className="font-medium">{formatImportSummary(report)}</p>
              {report.servicesNeedingOauth.length > 0 && (
                <div>
                  <p className="text-amber-200">Needs OAuth reconnect:</p>
                  <ul className="list-disc pl-5 text-[#A8C4C0]">
                    {report.servicesNeedingOauth.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {report.warnings.length > 0 && (
                <div>
                  <p className="text-amber-200">Warnings:</p>
                  <ul className="list-disc pl-5 text-[#A8C4C0]">
                    {report.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border border-white/20 text-white hover:bg-white/10"
                onClick={() => setShowIdMap((value) => !value)}
              >
                {showIdMap ? "Hide id map" : "Show id map"}
              </Button>
              {showIdMap && (
                <pre className="max-h-40 overflow-auto rounded bg-black/40 p-2 text-xs">
                  {JSON.stringify(report.idMap, null, 2)}
                </pre>
              )}
              <Button
                className="rounded-full border px-6 text-sm font-semibold hover:opacity-90"
                style={{
                  background: "#C4B643",
                  borderColor: "#C4B643",
                  color: "black",
                }}
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
