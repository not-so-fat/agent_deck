import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { API_KEY_CARD_COLOR, CARD_FACE_CLASS, cardAccentStyle } from "@/lib/card-colors";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CredentialRegistrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CredentialRegistrationModal({
  open,
  onOpenChange,
}: CredentialRegistrationModalProps) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createCredentialMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/credentials", {
        label: name.trim(),
        value,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credentials/vault"] });
      queryClient.invalidateQueries({ queryKey: ["/api/decks"] });
      toast({
        title: "API key saved",
        description: `${name.trim()} is stored securely. Your agent can use it from the active deck.`,
      });
      onOpenChange(false);
      setName("");
      setValue("");
    },
    onError: (error: Error) => {
      toast({
        title: "Could not save API key",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const canSave = name.trim().length > 0 && value.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border bg-[#161612] text-[#E8F6F4]">
        <DialogHeader>
          <DialogTitle className="text-[#E8F6F4]">Register API key</DialogTitle>
          <DialogDescription className="text-[#A8C4C0]">
            Name the service and paste the key. Agent Deck handles the rest — stored in your vault, never shown again.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="credential-name" className="text-[#CFEAE6]">Service name</Label>
            <Input
              id="credential-name"
              placeholder="OpenAI, Linear, Slack…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-white/15 bg-[#0F0F0C] text-[#E8F6F4] placeholder:text-[#6B8581]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="credential-value" className="text-[#CFEAE6]">API key</Label>
            <Input
              id="credential-value"
              type="password"
              placeholder="Paste key from the service dashboard"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="border-white/15 bg-[#0F0F0C] text-[#E8F6F4] placeholder:text-[#6B8581]"
            />
          </div>

          <Button
            variant="ghost"
            className={`w-full border-2 hover:opacity-90 ${CARD_FACE_CLASS}`}
            style={cardAccentStyle(API_KEY_CARD_COLOR)}
            onClick={() => createCredentialMutation.mutate()}
            disabled={!canSave || createCredentialMutation.isPending}
          >
            Save to vault
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
