import { Deck } from "@agent-deck/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers, Star, Play, Plus, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface DeckManagementPanelProps {
  decks: Deck[];
  activeDeck?: Deck;
  isLoading: boolean;
}

export default function DeckManagementPanel({ 
  decks, 
  activeDeck, 
  isLoading 
}: DeckManagementPanelProps) {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newDeckData, setNewDeckData] = useState({
    name: "",
    description: "",
  });
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const activateDeckMutation = useMutation({
    mutationFn: async (deckId: string) => {
      return apiRequest('POST', `/api/decks/${deckId}/activate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/decks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/decks/active'] });
      toast({
        title: "Deck activated",
        description: "Your deck is now active and ready to use.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to activate deck",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createDeckMutation = useMutation({
    mutationFn: async (data: typeof newDeckData) => {
      return apiRequest('POST', '/api/decks', {
        name: data.name,
        description: data.description,
        isActive: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/decks'] });
      toast({
        title: "Deck created",
        description: `${newDeckData.name} has been created successfully.`,
      });
      setCreateModalOpen(false);
      setNewDeckData({ name: "", description: "" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create deck",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteDeckMutation = useMutation({
    mutationFn: async (deckId: string) => {
      return apiRequest('DELETE', `/api/decks/${deckId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/decks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/decks/active'] });
      toast({
        title: "Deck deleted",
        description: "Your deck has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      // Handle specific error for last deck deletion
      if (error.message.includes("Cannot delete the last deck")) {
        toast({
          title: "Cannot delete deck",
          description: "You cannot delete the last deck. Please create another deck first.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to delete deck",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const handleActivateDeck = (deckId: string) => {
    activateDeckMutation.mutate(deckId);
  };

  const handleDeleteDeck = (e: React.MouseEvent, deckId: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this deck? This action cannot be undone.')) {
      deleteDeckMutation.mutate(deckId);
    }
  };

  const handleCreateDeck = (e: React.FormEvent) => {
    e.preventDefault();
    createDeckMutation.mutate(newDeckData);
  };

  if (isLoading) {
    return (
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-6 shadow-2xl">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-white/10 rounded"></div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-white/5 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex flex-col" data-testid="deck-management-panel">
        <h2 className="text-lg font-bold mb-3 flex items-center">
          <Layers className="w-4 h-4 mr-2" style={{color: '#92E4DD'}} />
          <span style={{color: '#92E4DD'}}>My Decks</span>
        </h2>
        
        {/* Add Deck Button - Always Visible */}
        <div className="mb-3">
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="w-full border text-sm py-2"
            style={{
              background: '#C4B643',
              borderColor: '#C4B643',
              color: 'black'
            }}
            data-testid="create-deck-button"
          >
            <Plus className="w-3 h-3 mr-2" />
            Add Deck
          </Button>
        </div>
        
        {/* Scrollable Deck List */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-2">
            {decks.map((deck) => (
              <div
                key={deck.id}
                className={`p-2 rounded-lg border cursor-pointer transition-all relative group ${
                  deck.isActive
                    ? "bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-2 border-yellow-500/40 hover:border-yellow-400/60"
                    : "bg-white/5 border border-white/10 hover:border-white/20"
                }`}
                onClick={() => !deck.isActive && handleActivateDeck(deck.id)}
                data-testid={`deck-item-${deck.id}`}
              >
                {/* Delete Button Overlay */}
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-5 w-5 p-0 bg-red-500/80 hover:bg-red-500 border-red-400"
                    onClick={(e) => handleDeleteDeck(e, deck.id)}
                    title="Delete deck"
                  >
                    <Trash2 className="w-2 h-2" />
                  </Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={`font-semibold text-sm ${deck.isActive ? 'text-yellow-300' : 'text-white'}`}>
                      {deck.name}
                    </h3>
                    <div className="flex items-center space-x-2">
                      <p className="text-xs text-gray-400">
                        {deck.isActive ? 
                          `${deck.services?.length || 0} cards` : 
                          (deck.services?.length || 0) > 0 ? 
                            `${deck.services?.length} cards` : 
                            'Empty'
                        }
                      </p>
                      {deck.isActive && (
                        <Badge variant="secondary" className="text-xs" style={{
                          background: 'rgba(196, 182, 67, 0.2)',
                          color: '#C4B643'
                        }}>
                          Active
                        </Badge>
                      )}
                    </div>
                  </div>
                  {deck.isActive ? (
                    <Star className="w-4 h-4" style={{color: '#C4B643'}} />
                  ) : (
                    <Play className="w-3 h-3 text-gray-400" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Deck Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-md bg-gradient-to-br from-cosmic-900 to-cosmic-800 border border-white/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center">
              <Plus className="w-5 h-5 mr-2 text-purple-400" />
              Create New Deck
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleCreateDeck} className="space-y-4" data-testid="form-create-deck">
            <div>
              <Label htmlFor="deckName" className="text-sm font-semibold">Deck Name</Label>
              <Input
                id="deckName"
                placeholder="e.g., Development Tools"
                value={newDeckData.name}
                onChange={(e) => setNewDeckData(prev => ({ ...prev, name: e.target.value }))}
                className="bg-white/10 border-white/20 text-white placeholder-gray-400"
                required
                data-testid="input-deck-name"
              />
            </div>
            
            <div>
              <Label htmlFor="deckDescription" className="text-sm font-semibold">Description</Label>
              <Textarea
                id="deckDescription"
                placeholder="Brief description of this deck..."
                value={newDeckData.description}
                onChange={(e) => setNewDeckData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="bg-white/10 border-white/20 text-white placeholder-gray-400 resize-none"
                data-testid="textarea-deck-description"
              />
            </div>
            
            <div className="flex space-x-3 pt-4">
              <Button 
                type="button" 
                variant="secondary" 
                className="flex-1" 
                onClick={() => setCreateModalOpen(false)}
                data-testid="button-cancel-create"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                disabled={createDeckMutation.isPending}
                data-testid="button-submit-create"
              >
                {createDeckMutation.isPending ? 'Creating...' : 'Create Deck'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
