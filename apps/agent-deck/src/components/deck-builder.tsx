import { Deck, Service } from "@agent-deck/shared";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Settings, Database, Cloud, Code, Brain, FileText, Mail, Calculator, BarChart } from "lucide-react";

interface DeckBuilderProps {
  deck: Deck;
  services: Service[];
  allServices: Service[];
  onDrop: (serviceId: string) => void;
  onDragStart: (e: React.DragEvent, serviceId: string) => void;
  onDragEnd: () => void;
  onCardClick: (service: Service) => void;
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
    const serviceId = e.dataTransfer.getData('text/plain');
    if (serviceId) {
      onDrop(serviceId);
    }
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
    const iconMap: { [key: string]: any } = {
      'database': Database,
      'cloud': Cloud,
      'code': Code,
      'brain': Brain,
      'file': FileText,
      'mail': Mail,
      'calculator': Calculator,
      'chart': BarChart,
      'settings': Settings,
    };

    // Try to match service name or description to icon
    const serviceText = `${service.name} ${service.description || ''}`.toLowerCase();
    
    for (const [key, icon] of Object.entries(iconMap)) {
      if (serviceText.includes(key)) {
        return icon;
      }
    }
    
    return Settings; // Default icon
  };

  const maxSize = 10; // Default max size for decks

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
        className="flex-1 bg-black/20 rounded-lg border-2 border-dashed border-white/10 p-4 overflow-y-auto"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{
          minHeight: '200px',
          background: services.length === 0 
            ? 'linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 100%)'
            : 'rgba(0,0,0,0.2)'
        }}
      >
        {services.length === 0 ? (
          <div className="text-center h-full flex flex-col justify-center">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-3">
              <Plus className="w-6 h-6 text-blue-400" />
            </div>
            <h4 className="text-lg font-bold mb-2" style={{color: '#92E4DD'}}>
              Empty Deck
            </h4>
            <p className="text-gray-300 mb-4 text-sm">
              Drag services from your collection to build your deck.
            </p>
            <div className="text-xs text-gray-400">
              {services.length}/{maxSize} cards
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,80px)] gap-2">
            {services.map((service, index) => {
              const IconComponent = getServiceIcon(service);
              return (
                <div
                  key={service.id}
                  className="relative group cursor-pointer"
                  draggable
                  onDragStart={(e) => onDragStart(e, service.id)}
                  onDragEnd={onDragEnd}
                  onClick={() => onCardClick(service)}
                >
                  <div
                    className="w-20 h-32 rounded-lg border-2 border-white/20 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm shadow-lg transform transition-all duration-200 hover:scale-105 hover:shadow-xl hover:border-white/40 relative overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${service.cardColor}20, ${service.cardColor}10)`,
                      borderColor: `${service.cardColor}40`,
                    }}
                  >
                    {/* Service Icon */}
                    <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                      <IconComponent className="w-3 h-3 text-white" />
                    </div>

                    {/* Service Name */}
                    <div className="absolute bottom-2 left-2 right-2">
                      <h4 className="text-xs font-bold text-white truncate">
                        {service.name}
                      </h4>
                      <p className="text-xs text-gray-300 truncate">
                        {service.type.toUpperCase()}
                      </p>
                    </div>

                    {/* Health Indicator */}
                    <div className="absolute top-2 right-2">
                      <div className={`w-2 h-2 rounded-full ${
                        service.health === 'healthy' ? 'bg-green-400' :
                        service.health === 'unhealthy' ? 'bg-red-400' :
                        'bg-yellow-400'
                      }`}></div>
                    </div>

                    {/* Remove Button */}
                    <button
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs hover:bg-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeServiceFromDeck(service.id);
                      }}
                      title="Remove from deck"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
