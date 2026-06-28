import { useState } from "react";
import { Credential, Playbook, Service } from "@agent-deck/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type DragKind = "service" | "credential" | "playbook";

type DragPayload = {
  kind: DragKind;
  id: string;
  fromDeck: boolean;
};

async function fetchPlaybookDependents(
  kind: "credential" | "service",
  id: string,
): Promise<Array<{ id: string; title: string }>> {
  const param = kind === "credential" ? `credentialId=${encodeURIComponent(id)}` : `serviceId=${encodeURIComponent(id)}`;
  const res = await apiRequest("GET", `/api/playbooks/dependents/check?${param}`);
  const body = await res.json();
  return body.data ?? [];
}

export function useDragAndDrop(editingDeckId?: string | null) {
  const [draggedService, setDraggedService] = useState<Service | null>(null);
  const [draggedCredential, setDraggedCredential] = useState<Credential | null>(null);
  const [draggedPlaybook, setDraggedPlaybook] = useState<Playbook | null>(null);
  const [isDraggingFromDeck, setIsDraggingFromDeck] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const requireEditingDeck = () => {
    if (!editingDeckId) {
      throw new Error("Select a deck to edit first");
    }
    return editingDeckId;
  };

  const addServiceToDeckMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const deckId = requireEditingDeck();
      const decksResponse = await apiRequest("GET", "/api/decks");
      const decksBody = await decksResponse.json();
      const deck = decksBody.data?.find((d: { id: string }) => d.id === deckId);

      if (!deck) {
        throw new Error("Selected deck not found");
      }

      if (deck.services?.some((s: Service) => s.id === serviceId)) {
        throw new Error("Service is already in the deck");
      }

      const position = deck.services?.length ?? 0;

      return apiRequest("POST", `/api/decks/${deckId}/services`, {
        serviceId,
        position,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/decks"] });
      toast({
        title: "Service added to deck",
        description: `${draggedService?.name || "Service"} has been added to the deck.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add service", description: error.message, variant: "destructive" });
    },
  });

  const addCredentialToDeckMutation = useMutation({
    mutationFn: async (credentialId: string) => {
      const deckId = requireEditingDeck();
      const decksResponse = await apiRequest("GET", "/api/decks");
      const decksBody = await decksResponse.json();
      const deck = decksBody.data?.find((d: { id: string }) => d.id === deckId);

      if (deck?.credentials?.some((c: Credential) => c.id === credentialId)) {
        throw new Error("API key is already in the deck");
      }

      return apiRequest("POST", `/api/decks/${deckId}/credentials`, { credentialId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/decks"] });
      toast({
        title: "API key added to deck",
        description: `${draggedCredential?.label || "API key"} is scoped to this deck.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add API key", description: error.message, variant: "destructive" });
    },
  });

  const addPlaybookToDeckMutation = useMutation({
    mutationFn: async (playbookId: string) => {
      const deckId = requireEditingDeck();
      const decksResponse = await apiRequest("GET", "/api/decks");
      const decksBody = await decksResponse.json();
      const deck = decksBody.data?.find((d: { id: string }) => d.id === deckId);

      if (deck?.playbooks?.some((p: Playbook) => p.id === playbookId)) {
        throw new Error("Playbook is already in the deck");
      }

      return apiRequest("POST", `/api/decks/${deckId}/playbooks`, { playbookId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/decks"] });
      toast({
        title: "Playbook added to deck",
        description: `${draggedPlaybook?.title || "Playbook"} is on this deck.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add playbook", description: error.message, variant: "destructive" });
    },
  });

  const removeServiceFromDeckMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const dependents = await fetchPlaybookDependents("service", serviceId);
      if (dependents.length > 0) {
        const names = dependents.map((item) => item.title).join(", ");
        const proceed = window.confirm(
          `Warning: ${dependents.length} playbook(s) depend on this MCP (${names}). Remove from deck anyway?`,
        );
        if (!proceed) {
          throw new Error("Cancelled");
        }
      }

      const deckId = requireEditingDeck();
      return apiRequest("DELETE", `/api/decks/${deckId}/services`, { serviceId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/decks"] });
      toast({
        title: "Service removed from deck",
        description: `${draggedService?.name || "Service"} has been removed from the deck.`,
      });
    },
    onError: (error: Error) => {
      if (error.message !== "Cancelled") {
        toast({ title: "Failed to remove service", description: error.message, variant: "destructive" });
      }
    },
  });

  const removeCredentialFromDeckMutation = useMutation({
    mutationFn: async (credentialId: string) => {
      const dependents = await fetchPlaybookDependents("credential", credentialId);
      if (dependents.length > 0) {
        const names = dependents.map((item) => item.title).join(", ");
        const proceed = window.confirm(
          `Warning: ${dependents.length} playbook(s) depend on this API key (${names}). Remove from deck anyway?`,
        );
        if (!proceed) {
          throw new Error("Cancelled");
        }
      }

      const deckId = requireEditingDeck();
      return apiRequest("DELETE", `/api/decks/${deckId}/credentials`, { credentialId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/decks"] });
      toast({
        title: "API key removed from deck",
        description: `${draggedCredential?.label || "API key"} is no longer on this deck.`,
      });
    },
    onError: (error: Error) => {
      if (error.message !== "Cancelled") {
        toast({ title: "Failed to remove API key", description: error.message, variant: "destructive" });
      }
    },
  });

  const removePlaybookFromDeckMutation = useMutation({
    mutationFn: async (playbookId: string) => {
      const deckId = requireEditingDeck();
      return apiRequest("DELETE", `/api/decks/${deckId}/playbooks`, { playbookId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/decks"] });
      toast({
        title: "Playbook removed from deck",
        description: `${draggedPlaybook?.title || "Playbook"} is no longer on this deck.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to remove playbook", description: error.message, variant: "destructive" });
    },
  });

  const setDragImageOpacity = (e: React.DragEvent, opacity: string) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = opacity;
    }
  };

  const writeDragData = (e: React.DragEvent, payload: DragPayload) => {
    e.dataTransfer.setData("text/plain", payload.id);
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = payload.fromDeck ? "move" : "copy";
  };

  const handleDragStart = (e: React.DragEvent, service: Service, fromDeck = false) => {
    setDraggedService(service);
    setDraggedCredential(null);
    setDraggedPlaybook(null);
    setIsDraggingFromDeck(fromDeck);
    writeDragData(e, { kind: "service", id: service.id, fromDeck });
    setDragImageOpacity(e, "0.5");
  };

  const handleCredentialDragStart = (
    e: React.DragEvent,
    credential: Credential,
    fromDeck = false,
  ) => {
    setDraggedCredential(credential);
    setDraggedService(null);
    setDraggedPlaybook(null);
    setIsDraggingFromDeck(fromDeck);
    writeDragData(e, { kind: "credential", id: credential.id, fromDeck });
    setDragImageOpacity(e, "0.5");
  };

  const handlePlaybookDragStart = (
    e: React.DragEvent,
    playbook: Playbook,
    fromDeck = false,
  ) => {
    setDraggedPlaybook(playbook);
    setDraggedService(null);
    setDraggedCredential(null);
    setIsDraggingFromDeck(fromDeck);
    writeDragData(e, { kind: "playbook", id: playbook.id, fromDeck });
    setDragImageOpacity(e, "0.5");
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedService(null);
    setDraggedCredential(null);
    setDraggedPlaybook(null);
    setDragImageOpacity(e, "1");
  };

  const resolveDrop = (payload: DragPayload) => {
    if (payload.kind === "service") {
      if (payload.fromDeck) {
        removeServiceFromDeckMutation.mutate(payload.id);
      } else {
        addServiceToDeckMutation.mutate(payload.id);
      }
      return;
    }

    if (payload.kind === "credential") {
      if (payload.fromDeck) {
        removeCredentialFromDeckMutation.mutate(payload.id);
      } else {
        addCredentialToDeckMutation.mutate(payload.id);
      }
      return;
    }

    if (payload.fromDeck) {
      removePlaybookFromDeckMutation.mutate(payload.id);
    } else {
      addPlaybookToDeckMutation.mutate(payload.id);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();

    const dragData = e.dataTransfer.getData("application/json");
    if (!dragData) {
      return;
    }

    try {
      resolveDrop(JSON.parse(dragData) as DragPayload);
    } catch {
      const serviceId = e.dataTransfer.getData("text/plain");
      if (serviceId && draggedService) {
        addServiceToDeckMutation.mutate(serviceId);
      }
    }

    setDraggedService(null);
    setDraggedCredential(null);
    setDraggedPlaybook(null);
    setIsDraggingFromDeck(false);
  };

  const handleGlobalDrop = (e: React.DragEvent) => {
    e.preventDefault();

    const dragData = e.dataTransfer.getData("application/json");
    if (!dragData) {
      return;
    }

    try {
      const payload = JSON.parse(dragData) as DragPayload;
      if (payload.fromDeck) {
        resolveDrop(payload);
      }
    } catch {
      // Ignore malformed drag payloads outside the deck
    }

    setDraggedService(null);
    setDraggedCredential(null);
    setDraggedPlaybook(null);
    setIsDraggingFromDeck(false);
  };

  return {
    draggedService,
    draggedCredential,
    draggedPlaybook,
    isDraggingFromDeck,
    handleDragStart,
    handleCredentialDragStart,
    handlePlaybookDragStart,
    handleDragEnd,
    handleDrop,
    handleGlobalDrop,
    isDropping:
      addServiceToDeckMutation.isPending ||
      addCredentialToDeckMutation.isPending ||
      addPlaybookToDeckMutation.isPending ||
      removeServiceFromDeckMutation.isPending ||
      removeCredentialFromDeckMutation.isPending ||
      removePlaybookFromDeckMutation.isPending,
  };
}
