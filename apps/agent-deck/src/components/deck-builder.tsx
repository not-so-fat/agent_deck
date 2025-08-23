import { Deck, Service } from "@agent-deck/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Trash2, Plus, X, Database, Brain, Edit2, Check, X as XIcon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface DeckBuilderProps {
  deck: Deck;
  services: Service[];
  allServices: Service[];
  onDrop: (e: React.DragEvent) => void;
  onDragStart: (e: React.DragEvent, service: Service, fromDeck?: boolean) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onCardClick?: (service: Service) => void;
}



const getServiceIcon = (service: Service) => {
  return service.type === 'mcp' ? <Database className="w-4 h-4" /> : <Brain className="w-4 h-4" />;
};



export default function DeckBuilder({ 
  deck, 
  services, 
  allServices,
  onDrop, 
  onDragStart, 
  onDragEnd,
  onCardClick
}: DeckBuilderProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState(deck.name);

  const removeFromDeckMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      return apiRequest('DELETE', `/api/decks/${deck.id}/services`, {
        serviceId: serviceId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/decks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/decks/active'] });
      toast({
        title: "Service removed",
        description: "Service has been removed from your deck.",
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

  const clearDeckMutation = useMutation({
    mutationFn: async () => {
      // Use the bulk clear operation
      return apiRequest('DELETE', `/api/decks/${deck.id}/services/clear`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/decks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/decks/active'] });
      toast({
        title: "Deck cleared",
        description: "All services have been removed from your deck.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to clear deck",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateDeckNameMutation = useMutation({
    mutationFn: async (newName: string) => {
      return apiRequest('PUT', `/api/decks/${deck.id}`, {
        name: newName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/decks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/decks/active'] });
      setIsEditingName(false);
      toast({
        title: "Deck name updated",
        description: "Deck name has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update deck name",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRemoveFromDeck = (serviceId: string) => {
    removeFromDeckMutation.mutate(serviceId);
  };

  const handleClearDeck = () => {
    clearDeckMutation.mutate();
  };

  const handleEditName = () => {
    setIsEditingName(true);
    setEditingName(deck.name);
  };

  const handleSaveName = () => {
    if (editingName.trim() && editingName.trim() !== deck.name) {
      updateDeckNameMutation.mutate(editingName.trim());
    } else {
      setIsEditingName(false);
      setEditingName(deck.name);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
    setEditingName(deck.name);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const hasEmptySlots = (deck.services?.length || 0) < (deck.maxSize || 10);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Star className="w-6 h-6 mr-3" style={{color: '#C4B643'}} />
          {isEditingName ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={handleKeyPress}
                className="text-2xl font-bold bg-transparent border-b-2 border-yellow-400 focus:outline-none focus:border-yellow-300"
                style={{background: 'linear-gradient(to right, #C4B643, #D4C760)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'}}
                autoFocus
              />
              <Button
                size="sm"
                onClick={handleSaveName}
                disabled={updateDeckNameMutation.isPending}
                className="p-1 h-6 w-6"
              >
                <Check className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancelEdit}
                className="p-1 h-6 w-6"
              >
                <XIcon className="w-3 h-3" />
              </Button>
            </div>
                      ) : (
              <div className="flex items-center space-x-2 group">
                <span 
                  className="text-2xl font-bold cursor-pointer hover:opacity-80 transition-opacity"
                  style={{background: 'linear-gradient(to right, #C4B643, #D4C760)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'}}
                  onClick={handleEditName}
                >
                  Active Deck: {deck.name}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleEditName}
                  className="p-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
              </div>
            )}
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-400" data-testid="deck-card-count">
            {deck.services?.length || 0}/{deck.maxSize || 10} cards
          </span>
          <Button
            size="sm"
            className="border text-white"
            style={{
              background: '#ad095e',
              borderColor: '#ad095e'
            }}
            onClick={handleClearDeck}
                          disabled={clearDeckMutation.isPending || !deck.services?.length}
            data-testid="button-clear-deck"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Clear
          </Button>
        </div>
      </div>
      
      {/* Deck Slots - Card Game Style */}
      <div 
        className="relative flex-1 p-4 rounded-xl border-2 border-dashed flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, rgba(196, 182, 67, 0.1), rgba(212, 199, 96, 0.1))',
          borderColor: 'rgba(196, 182, 67, 0.3)'
        }}
        onDrop={onDrop}
        onDragOver={handleDragOver}
        data-testid="deck-drop-zone"
      >
        <div className="relative flex items-center justify-center" style={{ width: 'fit-content' }}>
          {services.length === 0 ? (
            /* Empty deck state */
            <div className="text-center">
              <div className="w-32 h-48 border-2 border-dashed border-gray-500 rounded-lg flex items-center justify-center opacity-50 hover:opacity-75 transition-all mb-4">
                <Plus className="w-8 h-8 text-gray-500" />
              </div>
            </div>
          ) : (
            /* Cards with overlap animation */
            <div className="flex items-center justify-center space-x-[-60px] hover:space-x-4 transition-all duration-500 group">
              {services.map((service, index) => {
                return (
                  <div 
                    key={service.id} 
                    className="relative transition-all duration-500 hover:z-20 hover:scale-110"
                    style={{ 
                      zIndex: services.length - index,
                      transform: `rotate(${(index - services.length / 2) * 2}deg)`
                    }}
                  >
                    <div 
                      className={`
                        w-32 h-48 aspect-[2/3] rounded-lg border-2 p-3 
                        transform transition-all duration-500 shadow-lg hover:shadow-2xl
                        bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900
                        relative overflow-hidden cursor-pointer
                        hover:rotate-0
                      `}
                      style={{
                        borderColor: service.cardColor || '#7ed4da',
                        boxShadow: `0 0 20px ${service.cardColor ? `${service.cardColor}20` : '#7ed4da20'}`
                      }}
                      draggable
                      onDragStart={(e) => onDragStart(e, service, true)}
                      onDragEnd={onDragEnd}
                      onClick={() => onCardClick?.(service)}
                      data-testid={`deck-card-${service.id}`}
                    >
                      {/* Playing Card Corner - Top Left */}
                      <div className="absolute top-1 left-1 text-xs font-bold">
                        <div className="leading-none" style={{ color: service.cardColor || '#7ed4da' }}>
                          {service.type === 'mcp' ? 'M' : 'A'}
                        </div>
                      </div>
                      
                      {/* Playing Card Corner - Bottom Right (upside down) */}
                      <div className="absolute bottom-1 right-1 text-xs font-bold rotate-180">
                        <div className="leading-none" style={{ color: service.cardColor || '#7ed4da' }}>
                          {service.type === 'mcp' ? 'M' : 'A'}
                        </div>
                      </div>
                      

                      
                      {/* Card Center Content */}
                      <div className="absolute inset-x-2 top-6 bottom-8 flex flex-col items-center justify-center text-center">
                        {/* Main Icon */}
                        <div className="mb-2" style={{ color: service.cardColor || '#7ed4da' }}>
                          {getServiceIcon(service)}
                        </div>
                        
                        {/* Service Name */}
                        <h3 
                          className="font-bold text-xs mb-1 line-clamp-2" 
                          data-testid={`deck-card-name-${service.id}`}
                          style={{ color: service.cardColor || '#7ed4da' }}
                        >
                          {service.name}
                        </h3>
                        
                        {/* Service Type Badge */}
                        <div className="text-[8px] px-1 py-0.5 rounded border opacity-70" style={{ 
                          color: service.cardColor || '#7ed4da',
                          borderColor: service.cardColor || '#7ed4da'
                        }}>
                          {service.type.toUpperCase()}
                        </div>
                        

                      </div>
                      
                      {/* Remove Button */}
                      <Button
                        size="sm"
                        variant="destructive"
                        className="absolute -top-2 -right-2 w-6 h-6 p-0 rounded-full opacity-0 hover:opacity-100 transition-all text-xs"
                        onClick={() => handleRemoveFromDeck(service.id)}
                        data-testid={`button-remove-from-deck-${service.id}`}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                      
                      {/* Cyberpunk Glow Effect */}
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-transparent via-white/5 to-transparent opacity-0 hover:opacity-100 transition-all duration-500 pointer-events-none"></div>
                    </div>
                  </div>
                );
              })}
              
              {/* Single Add Card */}
              {hasEmptySlots && (
                <div 
                  className="w-32 h-48 aspect-[2/3] border-2 border-dashed border-gray-500 rounded-lg flex items-center justify-center opacity-50 hover:opacity-75 transition-all ml-4"
                  data-testid="empty-slot-add"
                >
                  <Plus className="w-8 h-8 text-gray-500" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
