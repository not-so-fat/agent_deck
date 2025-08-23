import { useState } from "react";
import { Service } from "@agent-deck/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useDragAndDrop() {
  const [draggedService, setDraggedService] = useState<Service | null>(null);
  const [isDraggingFromDeck, setIsDraggingFromDeck] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const addToDeckMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const activeDecksResponse = await apiRequest('GET', '/api/decks/active');
      const activeDeckResponse = await activeDecksResponse.json();
      
      if (!activeDeckResponse.data) {
        throw new Error('No active deck found');
      }

      const activeDeck = activeDeckResponse.data;
      const currentServiceCount = activeDeck.services?.length || 0;
      
      if (currentServiceCount >= (activeDeck.maxSize || 10)) {
        throw new Error(`Deck is full (max ${activeDeck.maxSize || 10} cards)`);
      }

      // Check if service is already in deck
      if (activeDeck.services?.some(s => s.id === serviceId)) {
        throw new Error('Service is already in the deck');
      }

      return apiRequest('POST', `/api/decks/${activeDeck.id}/services`, {
        serviceId: serviceId,
        position: currentServiceCount, // Add to the end
      });
    },
    onSuccess: (_, serviceId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/decks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/decks/active'] });
      
      const serviceName = draggedService?.name || 'Service';
      toast({
        title: "Service added to deck",
        description: `${serviceName} has been added to your active deck.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add service",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeFromDeckMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const activeDecksResponse = await apiRequest('GET', '/api/decks/active');
      const activeDeckResponse = await activeDecksResponse.json();
      
      if (!activeDeckResponse.data) {
        throw new Error('No active deck found');
      }

      const activeDeck = activeDeckResponse.data;

      return apiRequest('DELETE', `/api/decks/${activeDeck.id}/services`, {
        serviceId: serviceId,
      });
    },
    onSuccess: (_, serviceId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/decks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/decks/active'] });
      
      const serviceName = draggedService?.name || 'Service';
      toast({
        title: "Service removed from deck",
        description: `${serviceName} has been removed from your deck.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove service",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDragStart = (e: React.DragEvent, service: Service, fromDeck: boolean = false) => {
    setDraggedService(service);
    setIsDraggingFromDeck(fromDeck);
    e.dataTransfer.setData('text/plain', service.id);
    e.dataTransfer.setData('application/json', JSON.stringify({ serviceId: service.id, fromDeck }));
    e.dataTransfer.effectAllowed = fromDeck ? 'move' : 'copy';
    
    // Set drag image
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedService(null);
    
    // Reset opacity
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    const serviceId = e.dataTransfer.getData('text/plain');
    const dragData = e.dataTransfer.getData('application/json');
    
    if (serviceId && draggedService) {
      try {
        const { fromDeck } = JSON.parse(dragData);
        if (fromDeck) {
          // Dropping from deck - remove the service
          removeFromDeckMutation.mutate(serviceId);
        } else {
          // Dropping from collection - add the service
          addToDeckMutation.mutate(serviceId);
        }
      } catch {
        // Fallback to add behavior for backward compatibility
        addToDeckMutation.mutate(serviceId);
      }
    }
    
    setDraggedService(null);
    setIsDraggingFromDeck(false);
  };

  const handleGlobalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    const serviceId = e.dataTransfer.getData('text/plain');
    const dragData = e.dataTransfer.getData('application/json');
    
    if (serviceId && draggedService) {
      try {
        const { fromDeck } = JSON.parse(dragData);
        if (fromDeck) {
          // Dropping outside deck - remove the service
          removeFromDeckMutation.mutate(serviceId);
        }
      } catch {
        // Ignore if not from deck
      }
    }
    
    setDraggedService(null);
    setIsDraggingFromDeck(false);
  };

  return {
    draggedService,
    isDraggingFromDeck,
    handleDragStart,
    handleDragEnd,
    handleDrop,
    handleGlobalDrop,
    isDropping: addToDeckMutation.isPending || removeFromDeckMutation.isPending,
  };
}
