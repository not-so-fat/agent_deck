import { Deck, Service } from "@agent-deck/shared";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import agentIconUrl from "@/assets/icons/Agent2.svg";

interface DeckBuilderProps {
  deck: Deck;
  services: Service[];
  allServices: Service[];
  onDrop: (e: React.DragEvent) => void;
  onDragStart: (e: React.DragEvent, service: Service, fromDeck?: boolean) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onCardClick?: (service: Service) => void;
}

export default function DeckBuilder({
  deck,
  services,
  onDrop,
  onDragStart,
  onDragEnd,
  onCardClick,
}: DeckBuilderProps) {
  const { toast } = useToast();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDrop(e);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeServiceFromDeck = async (serviceId: string) => {
    try {
      const response = await apiRequest('DELETE', `/api/decks/${deck.id}/services`, {
        serviceId
      });

      if (response.ok) {
        toast({
          title: "Service removed",
          description: "Service has been removed from the deck.",
        });
        // Refresh the page to update the UI
        window.location.reload();
      } else {
        throw new Error('Failed to remove service from deck');
      }
    } catch (error) {
      console.error('Error removing service from deck:', error);
      toast({
        title: "Error",
        description: "Failed to remove service from deck.",
        variant: "destructive",
      });
    }
  };

  const getServiceIcon = (service: Service) => {
    const color = service.cardColor || '#7ed4da';
    return (
      <div
        style={{
          width: 28,
          height: 28,
          backgroundColor: color,
          WebkitMask: `url(${agentIconUrl}) no-repeat center / contain`,
          mask: `url(${agentIconUrl}) no-repeat center / contain`,
        }}
      />
    );
  };

  const maxSize = 10; // Default max size for decks
  const hasEmptySlots = (deck.services?.length || services.length) < (deck.maxSize || maxSize);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center">
          <i className="fas fa-layer-group mr-2 text-blue-400"></i>
          Active Deck
          <span className="ml-2 text-sm font-normal text-gray-400">
            ({services.length} cards)
          </span>
        </h3>
        
        <div className="flex items-center space-x-2">
          <div className="text-xs text-gray-400">
            {services.length}/{maxSize} cards
          </div>
        </div>
      </div>

      <div
        className="relative flex-1 p-4 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{
          minHeight: '200px',
          background: 'linear-gradient(135deg, rgba(196, 182, 67, 0.1), rgba(212, 199, 96, 0.1))',
          borderColor: 'rgba(196, 182, 67, 0.3)'
        }}
        data-testid="deck-drop-zone"
      >
        <div className="relative flex items-center justify-center" style={{ width: 'fit-content' }}>
          {services.length === 0 ? (
            <div className="text-center">
              <div className="w-32 h-48 border-2 border-dashed border-gray-500 rounded-lg flex items-center justify-center opacity-50 hover:opacity-75 transition-all mb-4">
                <Plus className="w-8 h-8 text-gray-500" />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-[-60px] hover:space-x-4 transition-all duration-500 group">
              {services.map((service, index) => {
                const IconComponent = getServiceIcon(service);
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
                      onDragEnd={(e) => onDragEnd(e)}
                      onClick={() => onCardClick?.(service)}
                      data-testid={`deck-card-${service.id}`}
                    >
                      <div className="absolute top-1 left-1 text-xs font-bold">
                        <div className="leading-none" style={{ color: service.cardColor || '#7ed4da' }}>
                          {service.type === 'mcp' ? 'RM' : service.type === 'local-mcp' ? 'LM' : 'A'}
                        </div>
                      </div>
                      <div className="absolute bottom-1 right-1 text-xs font-bold rotate-180">
                        <div className="leading-none" style={{ color: service.cardColor || '#7ed4da' }}>
                          {service.type === 'mcp' ? 'RM' : service.type === 'local-mcp' ? 'LM' : 'A'}
                        </div>
                      </div>

                      <div className="absolute inset-x-2 top-6 bottom-8 flex flex-col items-center justify-center text-center">
                        <div className="mb-2" style={{ color: service.cardColor || '#7ed4da' }}>
                          {IconComponent}
                        </div>
                        <h3
                          className="font-bold text-xs mb-1 line-clamp-2"
                          data-testid={`deck-card-name-${service.id}`}
                          style={{ color: service.cardColor || '#7ed4da' }}
                        >
                          {service.name}
                        </h3>
                        <div className="text-[8px] px-1 py-0.5 rounded border opacity-70" style={{ 
                          color: service.cardColor || '#7ed4da',
                          borderColor: service.cardColor || '#7ed4da'
                        }}>
                          {service.type === 'mcp' ? 'Remote MCP' : service.type === 'local-mcp' ? 'Local MCP' : 'A2A'}
                        </div>
                      </div>

                      {/* Removed trash button from Active Deck cards to match design */}

                      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none"></div>
                    </div>
                  </div>
                );
              })}

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
