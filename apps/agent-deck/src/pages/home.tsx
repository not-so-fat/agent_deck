import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Service, Deck } from "@agent-deck/shared";
import CardComponent from "@/components/card-component";
import DeckBuilder from "@/components/deck-builder";
import ServiceRegistrationModal from "@/components/service-registration-modal";
import DeckManagementPanel from "@/components/deck-management-panel";
import ServiceDetailsModal from "@/components/service-details-modal";
import { useWebSocket } from "@/hooks/use-websocket";
import { useDragAndDrop } from "@/hooks/use-drag-and-drop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Settings, Layers, Bolt, Server, Bot, Download, Copy, Plus, Filter } from "lucide-react";
import AgentDeckLogo from "@/assets/AgentDeckLogo2.png";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [mcpModalOpen, setMcpModalOpen] = useState(false);
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [serviceDetailsModalOpen, setServiceDetailsModalOpen] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  
  const { toast } = useToast();
  
  // WebSocket connection for real-time updates
  const { connectionStatus } = useWebSocket();
  
  // Drag and drop functionality
  const { handleDragStart, handleDragEnd, handleDrop, handleGlobalDrop, isDraggingFromDeck } = useDragAndDrop();

  // Fetch services
  const { data: servicesResponse, isLoading: servicesLoading, error: servicesError } = useQuery<{success: boolean, data: Service[]}>({
    queryKey: ['/api/services'],
  });

  // Fetch decks
  const { data: decksResponse, isLoading: decksLoading, error: decksError } = useQuery<{success: boolean, data: Deck[]}>({
    queryKey: ['/api/decks'],
  });

  // Fetch active deck - handle "No active deck found" as normal state
  const { data: activeDeckResponse, error: activeDeckError } = useQuery<{success: boolean, data: Deck}>({
    queryKey: ['/api/decks/active'],
    retry: false,
    retryOnMount: false,
  });
  
  const activeDeck = activeDeckResponse?.data;

  // Extract services and decks from response
  const servicesArray = servicesResponse?.data || [];
  const decksArray = decksResponse?.data || [];

  // Debug: Log any errors (ignore "No active deck found" as it's expected)
  if (servicesError) console.error('Services error:', servicesError);
  if (decksError) console.error('Decks error:', decksError);
  if (activeDeckError && !activeDeckError.message?.includes('No active deck found')) {
    console.error('Active deck error:', activeDeckError);
  }

  // Debug: Log current state
  console.log('Home component render:', {
    services: servicesArray.length,
    decks: decksArray.length,
    activeDeck: activeDeck?.name,
    servicesLoading,
    decksLoading,
    connectionStatus
  });

  // Filter services based on search and filters
  const filteredServices = servicesArray.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         service.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !typeFilter || typeFilter === 'all' || service.type === typeFilter;
    const matchesColor = !colorFilter || colorFilter === 'all' || service.cardColor === colorFilter;
    
    return matchesSearch && matchesType && matchesColor;
  });

  // Get services in active deck
  const activeDeckServices = activeDeck?.services || [];

  // Handle card click to show service details
  const handleCardClick = (service: Service) => {
    setSelectedService(service);
    setServiceDetailsModalOpen(true);
  };

  const handleCardHover = (serviceId: string | null) => {
    setHoveredCardId(serviceId);
  };

  // Add error boundary (ignore "No active deck found" as it's expected)
  const hasFatalError = servicesError || decksError || 
    (activeDeckError && !activeDeckError.message?.includes('No active deck found'));
  
  if (hasFatalError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Error Loading Data</h2>
          <p className="text-gray-300 mb-4">There was an error loading the application data.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  // Add loading state
  if (servicesLoading || decksLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading AgentDeck...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen"
      onDrop={handleGlobalDrop}
      onDragOver={(e) => e.preventDefault()}
      style={{
        position: 'relative',
        ...(isDraggingFromDeck && {
          background: 'linear-gradient(to bottom right, #1a1a2e, #16213e, #0f3460)',
        })
      }}
    >
      {/* Header */}
      <header className="relative z-20 bg-black/30 backdrop-blur-md border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-xl flex items-center justify-center shadow-lg overflow-hidden" style={{background: 'linear-gradient(135deg, #C4B643, #D4C760)'}}>
                <img 
                  src={AgentDeckLogo} 
                  alt="Agent Deck Logo" 
                  className="w-14 h-14 object-contain"
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent" style={{background: 'linear-gradient(to right, #C4B643, #D4C760)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'}}>
                  AgentDeck
                </h1>
                <p className="text-sm" style={{color: '#92E4DD'}}>Build tool deck for your agent</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              {/* Connection Status */}
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full border ${
                connectionStatus === 'connected' 
                  ? 'bg-emerald-500/20 border-emerald-500/30' 
                  : 'bg-red-500/20 border-red-500/30'
              }`}>
                <div className={`w-2 h-2 rounded-full animate-pulse ${
                  connectionStatus === 'connected' ? 'bg-emerald-400' : 'bg-red-400'
                }`}></div>
                <button 
                  className={`text-sm hover:underline cursor-pointer ${
                    connectionStatus === 'connected' ? 'text-emerald-300' : 'text-red-300'
                  }`} 
                  data-testid="button-copy-mcp-url"
                  onClick={() => {
                    const mcpUrl = 'http://localhost:3001/mcp';
                    navigator.clipboard.writeText(mcpUrl).then(() => {
                      toast({
                        title: "MCP URL copied!",
                        description: "The MCP server URL has been copied to your clipboard.",
                      });
                    });
                  }}
                  title="Click to copy MCP URL"
                >
                  Get MCP URL
                </button>
              </div>
              
              {/* Active Deck Indicator */}
              {activeDeck && (
                <div className="px-4 py-2 rounded-lg border" style={{
                  backgroundColor: 'rgba(196, 182, 67, 0.2)',
                  borderColor: 'rgba(196, 182, 67, 0.4)'
                }}>
                  <div className="flex items-center space-x-2">
                    <i className="fas fa-star" style={{color: '#C4B643'}}></i>
                    <span className="text-sm font-medium" data-testid="active-deck-name" style={{color: '#92E4DD'}}>
                      {activeDeck.name}
                    </span>
                    <span className="text-xs" style={{color: '#92E4DD', opacity: 0.7}} data-testid="active-deck-count">
                      {activeDeck.services?.length || 0} cards
                    </span>
                  </div>
                </div>
              )}
              

            </div>
          </div>
        </div>
      </header>

      {/* Global Drop Zone Indicator */}
      {isDraggingFromDeck && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="bg-red-500/20 border-2 border-dashed border-red-500/50 rounded-lg p-8 text-center">
            <div className="text-red-400 text-lg font-bold mb-2">Drop to Remove</div>
            <div className="text-red-300 text-sm">Release to remove card from deck</div>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-screen">
          
          {/* Left Sidebar - 25% width */}
          <div className="xl:col-span-1 space-y-6">
            {/* My Decks */}
            <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-4 shadow-2xl h-80">
              <DeckManagementPanel
                decks={decksArray}
                activeDeck={activeDeck}
                isLoading={decksLoading}
              />
            </div>
            
            {/* Manage Collection */}
            <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-4 shadow-2xl">
              <h2 className="text-lg font-bold mb-3 flex items-center">
                <Bolt className="w-4 h-4 mr-2" style={{color: '#92E4DD'}} />
                <span style={{color: '#92E4DD'}}>Manage Collection</span>
              </h2>
              
              <div className="space-y-2">
                <Button 
                  className="w-full border text-sm py-2"
                  style={{
                    background: '#02A4D3',
                    borderColor: '#02A4D3',
                    color: 'black'
                  }}
                  onClick={() => setMcpModalOpen(true)}
                  data-testid="button-register-mcp"
                >
                  <Server className="w-3 h-3 mr-2" style={{color: 'black'}} />
                  Register MCP
                </Button>
                
                <Button 
                  className="w-full border text-sm py-2"
                  style={{
                    background: '#02A4D3',
                    borderColor: '#02A4D3',
                    color: 'black'
                  }}
                  onClick={() => setAgentModalOpen(true)}
                  data-testid="button-register-agent"
                >
                  <Bot className="w-3 h-3 mr-2" style={{color: 'black'}} />
                  Register A2A
                </Button>
                
                <Button 
                  className="w-full border opacity-50 cursor-not-allowed text-sm py-2"
                  style={{
                    background: '#02A4D3',
                    borderColor: '#02A4D3',
                    color: 'black'
                  }}
                  disabled
                  data-testid="button-import-deck"
                >
                  <Download className="w-3 h-3 mr-2" style={{color: 'black'}} />
                  <div className="flex flex-col items-center">
                    <span>Import Deck</span>
                    <span className="text-xs opacity-70">(Coming Soon)</span>
                  </div>
                </Button>
              </div>
            </div>
          </div>
          
          {/* Main Content - 75% width */}
          <div className="xl:col-span-3 space-y-6">
            {/* Active Deck */}
            <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-4 shadow-2xl h-80">
              {activeDeck ? (
                <div className="h-full">
                  <DeckBuilder
                    deck={activeDeck}
                    services={activeDeckServices}
                    allServices={servicesArray}
                    onDrop={handleDrop}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onCardClick={handleCardClick}
                  />
                </div>
              ) : (
                <div className="text-center h-full flex flex-col justify-center">
                  <div className="w-12 h-12 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center mx-auto mb-3">
                    <Layers className="w-6 h-6 text-yellow-400" />
                  </div>
                  <h3 className="text-lg font-bold mb-2" style={{color: '#92E4DD'}}>
                    No Active Deck
                  </h3>
                  <p className="text-gray-300 mb-4 text-sm">
                    Create a new deck or activate an existing one to get started.
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button 
                      onClick={() => {
                        const createButton = document.querySelector('[data-testid="create-deck-button"]') as HTMLButtonElement;
                        if (createButton) createButton.click();
                      }}
                      className="border text-sm py-2"
                      style={{
                        background: '#C4B643',
                        borderColor: '#C4B643',
                        color: 'black'
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create New Deck
                    </Button>
                    <Button 
                      variant="outline"
                      className="border-white/20 text-white hover:bg-white/10 text-sm py-2"
                      onClick={() => {
                        const deckPanel = document.querySelector('[data-testid="deck-management-panel"]');
                        if (deckPanel) deckPanel.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      <Layers className="w-4 h-4 mr-2" />
                      Manage Decks
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            {/* My Collection */}
            <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-4 shadow-2xl h-80">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center">
                  <i className="fas fa-th-large mr-3 text-blue-400"></i>
                  My Collection
                  <span className="ml-3 text-sm font-normal text-gray-400">
                    ({filteredServices.length} cards)
                  </span>
                </h2>
                
                {/* Search and Filter Controls */}
                <div className="flex items-center gap-2">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-48 pl-8 h-8 text-sm bg-white/10 border-white/20 text-white placeholder-gray-400"
                      data-testid="input-search"
                    />
                  </div>
                  
                  {/* Type Filter */}
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-20 h-8 bg-white/10 border-white/20 text-white text-sm" data-testid="select-type">
                      <Filter className="w-3 h-3 mr-1" />
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="mcp">MCP</SelectItem>
                      <SelectItem value="a2a">A2A</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Color Filter */}
                  <Select value={colorFilter} onValueChange={setColorFilter}>
                    <SelectTrigger className="w-20 h-8 bg-white/10 border-white/20 text-white text-sm" data-testid="select-color">
                      {colorFilter === 'all' || !colorFilter ? (
                        <div className="w-3 h-3 rounded-full mr-1 border border-white/20 relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-br from-[#7ed4da] via-[#F9386D] to-[#39FF14]"></div>
                          <div className="absolute inset-0 bg-gradient-to-tl from-[#E0E0E0] via-transparent to-[#FF6B00]"></div>
                        </div>
                      ) : (
                        <div className="w-3 h-3 rounded-full mr-1 border border-white/20" style={{ backgroundColor: colorFilter }}></div>
                      )}
                      <SelectValue placeholder="Color" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full border border-white/20 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#7ed4da] via-[#F9386D] to-[#39FF14]"></div>
                            <div className="absolute inset-0 bg-gradient-to-tl from-[#E0E0E0] via-transparent to-[#FF6B00]"></div>
                          </div>
                          All Colors
                        </div>
                      </SelectItem>
                      <SelectItem value="#7ed4da">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: '#7ed4da' }}></div>
                          Default
                        </div>
                      </SelectItem>
                      <SelectItem value="#F9386D">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: '#F9386D' }}></div>
                          Red
                        </div>
                      </SelectItem>
                      <SelectItem value="#39FF14">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: '#39FF14' }}></div>
                          Green
                        </div>
                      </SelectItem>
                      <SelectItem value="#E0E0E0">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: '#E0E0E0' }}></div>
                          Gray
                        </div>
                      </SelectItem>
                      <SelectItem value="#FF6B00">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: '#FF6B00' }}></div>
                          Orange
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Clear Filters Button */}
                  {(searchQuery || typeFilter || colorFilter) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 text-xs border-white/20 text-white hover:bg-white/10"
                      onClick={() => {
                        setSearchQuery("");
                        setTypeFilter("");
                        setColorFilter("");
                      }}
                      title="Clear all filters"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              
              {servicesLoading ? (
                <div className="grid grid-cols-[repeat(auto-fill,80px)] gap-0">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="bg-white/10 rounded-lg w-32 h-48 aspect-[2/3]"></div>
                    </div>
                  ))}
                </div>
              ) : filteredServices.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">
                    <i className="fas fa-layer-group text-4xl"></i>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-300 mb-2">No services found</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    {searchQuery || typeFilter || colorFilter 
                      ? "Try adjusting your search or filters"
                      : "Register your first MCP server or A2A agent to get started"
                    }
                  </p>
                  {!searchQuery && !typeFilter && !colorFilter && (
                    <div className="flex gap-3 justify-center">
                      <Button 
                        size="sm"
                        style={{
                          background: '#02A4D3',
                          borderColor: '#02A4D3',
                          color: 'black'
                        }}
                        onClick={() => setMcpModalOpen(true)}
                        data-testid="button-register-mcp-empty"
                      >
                        <Server className="w-3 h-3 mr-1" style={{color: 'black'}} />
                        Register MCP
                      </Button>
                      <Button 
                        size="sm"
                        style={{
                          background: '#02A4D3',
                          borderColor: '#02A4D3',
                          color: 'black'
                        }}
                        onClick={() => setAgentModalOpen(true)}
                        data-testid="button-register-agent-empty"
                      >
                        <Bot className="w-3 h-3 mr-1" style={{color: 'black'}} />
                        Register A2A
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,80px)] gap-0 relative isolate" style={{ isolation: 'isolate' }}>
                  {filteredServices.map((service, index) => (
                    <div 
                      key={service.id} 
                      className="relative group" 
                      style={{ 
                        zIndex: hoveredCardId === service.id ? 999999 : filteredServices.length - index 
                      }}
                    >
                      <CardComponent
                        service={service}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        isInActiveDeck={activeDeck?.services?.some(s => s.id === service.id) || false}
                        onCardClick={handleCardClick}
                        isInCollection={true}
                        onMouseEnter={() => handleCardHover(service.id)}
                        onMouseLeave={() => handleCardHover(null)}
                        activeDeck={activeDeck}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Cyberpunk Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-20 left-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-float" style={{animationDelay: '-1s'}}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-float" style={{animationDelay: '-2s'}}></div>
      </div>

      {/* Modals */}
      <ServiceRegistrationModal
        type="mcp"
        open={mcpModalOpen}
        onOpenChange={setMcpModalOpen}
      />
      
      <ServiceRegistrationModal
        type="a2a"
        open={agentModalOpen}
        onOpenChange={setAgentModalOpen}
      />

      <ServiceDetailsModal
        service={selectedService}
        isOpen={serviceDetailsModalOpen}
        onClose={() => setServiceDetailsModalOpen(false)}
      />
    </div>
  );
}
