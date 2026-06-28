import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Credential } from "@agent-deck/shared";
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
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { API_KEY_CARD_COLOR, CARD_FACE_CLASS, cardAccentStyle } from "@/lib/card-colors";
import { AlertTriangle, ExternalLink } from "lucide-react";

interface CredentialDetailsModalProps {
  credentialId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CredentialDetailsModal({
  credentialId,
  open,
  onOpenChange,
}: CredentialDetailsModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [label, setLabel] = useState("");
  const [docsUrl, setDocsUrl] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");

  const { data: response, isLoading } = useQuery<{ success: boolean; data: Credential }>({
    queryKey: credentialId ? [`/api/credentials/${credentialId}`] : ["credential-detail-disabled"],
    enabled: open && Boolean(credentialId),
  });

  const credential = response?.data;

  useEffect(() => {
    if (!credential) {
      return;
    }
    setLabel(credential.label);
    setDocsUrl(credential.docsUrl ?? "");
    setNewKeyValue("");
  }, [credential?.id, credential?.label, credential?.docsUrl]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!credentialId) {
        throw new Error("No credential selected");
      }

      const trimmedLabel = label.trim();
      if (!trimmedLabel) {
        throw new Error("Name is required");
      }

      const trimmedDocsUrl = docsUrl.trim();
      if (trimmedDocsUrl) {
        try {
          new URL(trimmedDocsUrl);
        } catch {
          throw new Error("Documentation link must be a valid URL");
        }
      }

      await apiRequest("PUT", `/api/credentials/${credentialId}`, {
        label: trimmedLabel,
        docsUrl: trimmedDocsUrl,
      });

      if (newKeyValue.trim()) {
        await apiRequest("POST", `/api/credentials/${credentialId}/rotate`, {
          value: newKeyValue.trim(),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credentials/vault"] });
      if (credentialId) {
        queryClient.invalidateQueries({ queryKey: [`/api/credentials/${credentialId}`] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/collection/warnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/decks"] });
      toast({
        title: newKeyValue.trim() ? "API key updated" : "API key saved",
        description: newKeyValue.trim()
          ? "Name, docs link, and key value were updated."
          : "Name and docs link were updated.",
      });
      setNewKeyValue("");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Could not save API key",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const canSave =
    label.trim().length > 0 &&
    (label.trim() !== credential?.label ||
      docsUrl.trim() !== (credential?.docsUrl ?? "") ||
      newKeyValue.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border bg-[#161612] text-[#E8F6F4]">
        <DialogHeader>
          <DialogTitle className="text-[#E8F6F4]">
            {credential?.label ?? "API key"}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs text-[#A8C4C0]">
            {credential?.id ?? credentialId}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !credential ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <div className="space-y-4">
            {!credential.hasSecret && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  No key is stored in your vault for this credential. Paste a key below to save
                  it — the value is never shown after saving.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="credential-detail-name" className="text-[#CFEAE6]">
                Name
              </Label>
              <Input
                id="credential-detail-name"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="border-white/15 bg-[#0F0F0C] text-[#E8F6F4] placeholder:text-[#6B8581]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="credential-detail-key" className="text-[#CFEAE6]">
                {credential.hasSecret ? "Rotate API key" : "API key"}
              </Label>
              <Input
                id="credential-detail-key"
                type="password"
                placeholder={
                  credential.hasSecret
                    ? "Leave blank to keep current key"
                    : "Paste key from the service dashboard"
                }
                value={newKeyValue}
                onChange={(e) => setNewKeyValue(e.target.value)}
                className="border-white/15 bg-[#0F0F0C] text-[#E8F6F4] placeholder:text-[#6B8581]"
              />
              {credential.hasSecret && (
                <p className="text-xs text-[#6B8581]">
                  Stored securely in Keychain. Enter a new value only when rotating.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="credential-detail-docs" className="text-[#CFEAE6]">
                Documentation link
              </Label>
              <div className="flex gap-2">
                <Input
                  id="credential-detail-docs"
                  type="url"
                  placeholder="https://…"
                  value={docsUrl}
                  onChange={(e) => setDocsUrl(e.target.value)}
                  className="border-white/15 bg-[#0F0F0C] text-[#E8F6F4] placeholder:text-[#6B8581]"
                />
                {docsUrl.trim() && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0 border-white/15 bg-[#0F0F0C] text-[#A8C4C0] hover:bg-white/5"
                    onClick={() => window.open(docsUrl.trim(), "_blank", "noopener,noreferrer")}
                    title="Open documentation"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              className={`w-full border-2 hover:opacity-90 ${CARD_FACE_CLASS}`}
              style={cardAccentStyle(API_KEY_CARD_COLOR)}
              onClick={() => saveMutation.mutate()}
              disabled={!canSave || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
