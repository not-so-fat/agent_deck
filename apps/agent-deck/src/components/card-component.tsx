import { memo } from "react";
import { Service, Deck } from "@agent-deck/shared";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Settings, Database, Cloud, Code, Brain, FileText, Mail, Calculator, BarChart, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface CardComponentProps {
  service: Service;
  onDragStart: (e: React.DragEvent, service: Service) => void;
  onDragEnd: (e: React.DragEvent) => void;
  isInActiveDeck: boolean;
  onCardClick?: (service: Service) => void;
  isInCollection?: boolean; // New prop to identify if card is in collection view
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  activeDeck?: Deck; // Add activeDeck prop
}



const getServiceIcon = (service: Service) => {
  const iconMap: Record<string, JSX.Element> = {
    database: <Database className="w-6 h-6" />,
    cloud: <Cloud className="w-6 h-6" />,
    aws: <Cloud className="w-6 h-6" />,
    git: <Code className="w-6 h-6" />,
    code: <Code className="w-6 h-6" />,
    ai: <Brain className="w-6 h-6" />,
    gpt: <Brain className="w-6 h-6" />,
    brain: <Brain className="w-6 h-6" />,
    file: <FileText className="w-6 h-6" />,
    email: <Mail className="w-6 h-6" />,
    mail: <Mail className="w-6 h-6" />,
    math: <Calculator className="w-6 h-6" />,
    calc: <Calculator className="w-6 h-6" />,
    analytics: <BarChart className="w-6 h-6" />,
    chart: <BarChart className="w-6 h-6" />,
  };

  const serviceName = service.name.toLowerCase();
  const serviceType = service.type.toLowerCase();
  
  for (const [key, icon] of Object.entries(iconMap)) {
    if (serviceName.includes(key) || serviceType.includes(key)) {
      return icon;
    }
  }
  
  return service.type === 'mcp' || service.type === 'local-mcp' ? <Database className="w-6 h-6" /> : <Brain className="w-6 h-6" />;
};



function CardComponent({ service, onDragStart, onDragEnd, isInActiveDeck, onCardClick, isInCollection = false, onMouseEnter, onMouseLeave, activeDeck }: CardComponentProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const addToDeckMutation = useMutation({
    mutationFn: async () => {
      if (!activeDeck) {
        throw new Error('No active deck found');
      }

      return apiRequest('POST', `/api/decks/${activeDeck.id}/services`, {
        serviceId: service.id,
        position: 0, // Add to the end
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/decks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/decks/active'] });
      toast({
        title: "Service added to deck",
        description: `${service.name} has been added to your active deck.`,
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

  const deleteServiceMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/services/${service.id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      queryClient.invalidateQueries({ queryKey: ['/api/decks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/decks/active'] });
      toast({
        title: "Service deleted",
        description: `${service.name} has been deleted successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete service",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddToDeck = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToDeckMutation.mutate();
  };

  const handleDeleteService = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete ${service.name}? This action cannot be undone.`)) {
      deleteServiceMutation.mutate();
    }
  };

  return (
    <div
      className={`relative group cursor-pointer`}
      draggable={!isInActiveDeck}
      onDragStart={(e) => onDragStart(e, service)}
      onDragEnd={onDragEnd}
      onClick={() => onCardClick?.(service)}
      data-testid={`card-${service.id}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className={`
        w-32 h-48 aspect-[2/3] rounded-lg border-2 p-3 
        transform transition-all duration-300 shadow-lg hover:shadow-2xl
        bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900
        relative overflow-hidden
        ${isInActiveDeck ? 'opacity-60' : ''}
        ${isInCollection ? 'hover:scale-110 hover:rotate-0' : 'hover:scale-105'}
      `}
      style={{
        borderColor: service.cardColor || '#7ed4da',
        boxShadow: `0 0 20px ${service.cardColor ? `${service.cardColor}20` : '#7ed4da20'}`
      }}>
        
        {/* Playing Card Corner - Top Left */}
        <div className="absolute top-1 left-1 text-xs font-bold">
          <div className="leading-none" style={{ color: service.cardColor || '#7ed4da' }}>
            {service.type === 'mcp' ? 'RM' : 
             service.type === 'local-mcp' ? 'LM' : 'A'}
          </div>
        </div>
        
        {/* Playing Card Corner - Bottom Right (upside down) */}
        <div className="absolute bottom-1 right-1 text-xs font-bold rotate-180">
          <div className="leading-none" style={{ color: service.cardColor || '#7ed4da' }}>
            {service.type === 'mcp' ? 'RM' : 
             service.type === 'local-mcp' ? 'LM' : 'A'}
          </div>
        </div>
        

        
        {/* Delete Button Overlay */}
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
          <Button
            size="sm"
            variant="destructive"
            className="h-5 w-5 p-0 bg-red-500/80 hover:bg-red-500 border-red-400"
            onClick={handleDeleteService}
            title={`Delete ${service.name}`}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
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
            data-testid={`text-service-name-${service.id}`}
            style={{ color: service.cardColor || '#7ed4da' }}
          >
            {service.name}
          </h3>
          
          {/* Service Type Badge */}
          <div className="text-[8px] px-1 py-0.5 rounded border opacity-70" style={{ 
            color: service.cardColor || '#7ed4da',
            borderColor: service.cardColor || '#7ed4da'
          }}>
            {service.type === 'mcp' ? 'Remote MCP' : 
             service.type === 'local-mcp' ? 'Local MCP' : 
             'A2A'}
          </div>
          

        </div>
        
        {/* Bottom Action Area */}
        <div className="absolute bottom-6 inset-x-1">
          <Button
            size="sm"
            className="w-full text-[8px] px-1 py-1 h-5 bg-black/20 hover:bg-black/40 border"
            style={{
              color: service.cardColor || '#7ed4da',
              borderColor: service.cardColor || '#7ed4da'
            }}
            onClick={handleAddToDeck}
            disabled={isInActiveDeck || addToDeckMutation.isPending}
            data-testid={`button-add-to-deck-${service.id}`}
          >
            {isInActiveDeck ? 'IN DECK' : 'ADD'}
          </Button>
        </div>
        
        {/* Cyberpunk Glow Effect */}
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none"></div>
      </div>
    </div>
  );
}

export default memo(CardComponent);
