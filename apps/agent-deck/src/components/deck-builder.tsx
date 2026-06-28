import { Deck, Service, Credential, Playbook } from "@agent-deck/shared";
import { getServiceCardColor, API_KEY_CARD_COLOR, PLAYBOOK_CARD_COLOR } from "@/lib/card-colors";
import { BookOpen, KeyRound, Plus } from "lucide-react";
import agentIconUrl from "@/assets/icons/Agent2.svg";
import { getServiceIconSrc } from "@/lib/service-icon";

interface DeckBuilderProps {
  deck: Deck;
  services: Service[];
  credentials?: Credential[];
  playbooks?: Playbook[];
  allServices: Service[];
  onDrop: (e: React.DragEvent) => void;
  onDragStart: (e: React.DragEvent, service: Service, fromDeck?: boolean) => void;
  onCredentialDragStart: (e: React.DragEvent, credential: Credential, fromDeck?: boolean) => void;
  onPlaybookDragStart: (e: React.DragEvent, playbook: Playbook, fromDeck?: boolean) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onCardClick?: (service: Service) => void;
  onPlaybookClick?: (playbook: Playbook) => void;
}

export default function DeckBuilder({
  deck,
  services,
  credentials = [],
  playbooks = [],
  onDrop,
  onDragStart,
  onCredentialDragStart,
  onPlaybookDragStart,
  onDragEnd,
  onCardClick,
  onPlaybookClick,
}: DeckBuilderProps) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDrop(e);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const getServiceIcon = (service: Service) => {
    const color = getServiceCardColor(service);
    const iconSrc = getServiceIconSrc(service);

    if (iconSrc) {
      return (
        <img
          src={iconSrc}
          alt=""
          className="w-7 h-7 object-contain rounded-sm"
          draggable={false}
        />
      );
    }

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

  const deckCards = services.length + credentials.length + playbooks.length;

  const renderPlaybookCard = (playbook: Playbook, cardIndex: number) => (
    <div
      key={playbook.id}
      className="relative transition-all duration-500 hover:z-20 hover:scale-110"
      style={{
        zIndex: deckCards - cardIndex,
        transform: `rotate(${(cardIndex - deckCards / 2) * 2}deg)`,
      }}
    >
      <div
        className="w-32 h-48 aspect-[2/3] rounded-lg border-2 p-3 transform transition-all duration-500 shadow-lg hover:shadow-2xl bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden cursor-pointer hover:rotate-0"
        style={{
          borderColor: PLAYBOOK_CARD_COLOR,
          boxShadow: `0 0 20px ${PLAYBOOK_CARD_COLOR}20`,
        }}
        draggable
        onDragStart={(e) => onPlaybookDragStart(e, playbook, true)}
        onDragEnd={onDragEnd}
        onClick={() => onPlaybookClick?.(playbook)}
        data-testid={`deck-card-${playbook.id}`}
      >
        <div className="absolute top-1 left-1 text-xs font-bold">
          <div className="leading-none" style={{ color: PLAYBOOK_CARD_COLOR }}>PB</div>
        </div>
        <div className="absolute bottom-1 right-1 text-xs font-bold rotate-180">
          <div className="leading-none" style={{ color: PLAYBOOK_CARD_COLOR }}>PB</div>
        </div>
        <div className="absolute inset-x-2 top-6 bottom-8 flex flex-col items-center justify-center text-center">
          <div className="mb-2" style={{ color: PLAYBOOK_CARD_COLOR }}>
            <BookOpen className="h-7 w-7" strokeWidth={2.25} />
          </div>
          <h3 className="font-bold text-xs mb-1 line-clamp-2" style={{ color: PLAYBOOK_CARD_COLOR }}>
            {playbook.title}
          </h3>
          <div
            className="text-[8px] px-1 py-0.5 rounded border opacity-70"
            style={{ color: PLAYBOOK_CARD_COLOR, borderColor: PLAYBOOK_CARD_COLOR }}
          >
            Playbook
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center">
          <i className="fas fa-layer-group mr-2 text-blue-400"></i>
          Deck
          <span className="ml-2 text-sm font-normal text-gray-400">{deck.name}</span>
          <span className="ml-2 text-sm font-normal text-gray-400">({deckCards} cards)</span>
        </h3>
      </div>

      <div
        className="relative flex-1 p-4 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{
          minHeight: "200px",
          background: "linear-gradient(135deg, rgba(196, 182, 67, 0.1), rgba(212, 199, 96, 0.1))",
          borderColor: "rgba(196, 182, 67, 0.3)",
        }}
        data-testid="deck-drop-zone"
      >
        <div className="relative flex items-center justify-center" style={{ width: "fit-content" }}>
          {deckCards === 0 ? (
            <div className="text-center">
              <div className="w-32 h-48 border-2 border-dashed border-gray-500 rounded-lg flex items-center justify-center opacity-50 hover:opacity-75 transition-all mb-4">
                <Plus className="w-8 h-8 text-gray-500" />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-[-60px] hover:space-x-4 transition-all duration-500 group">
              {credentials.map((credential, index) => (
                <div
                  key={credential.id}
                  className="relative transition-all duration-500 hover:z-20 hover:scale-110"
                  style={{
                    zIndex: deckCards - index,
                    transform: `rotate(${(index - deckCards / 2) * 2}deg)`,
                  }}
                >
                  <div
                    className="w-32 h-48 aspect-[2/3] rounded-lg border-2 p-3 transform transition-all duration-500 shadow-lg hover:shadow-2xl bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden cursor-pointer hover:rotate-0"
                    style={{
                      borderColor: API_KEY_CARD_COLOR,
                      boxShadow: `0 0 20px ${API_KEY_CARD_COLOR}20`,
                    }}
                    draggable
                    onDragStart={(e) => onCredentialDragStart(e, credential, true)}
                    onDragEnd={onDragEnd}
                    data-testid={`deck-card-${credential.id}`}
                  >
                    <div className="absolute top-1 left-1 text-xs font-bold">
                      <div className="leading-none" style={{ color: API_KEY_CARD_COLOR }}>AK</div>
                    </div>
                    <div className="absolute bottom-1 right-1 text-xs font-bold rotate-180">
                      <div className="leading-none" style={{ color: API_KEY_CARD_COLOR }}>AK</div>
                    </div>
                    <div className="absolute inset-x-2 top-6 bottom-8 flex flex-col items-center justify-center text-center">
                      <div className="mb-2" style={{ color: API_KEY_CARD_COLOR }}>
                        <KeyRound className="h-7 w-7" strokeWidth={2.25} />
                      </div>
                      <h3 className="font-bold text-xs mb-1 line-clamp-2" style={{ color: API_KEY_CARD_COLOR }}>
                        {credential.label}
                      </h3>
                      <div
                        className="text-[8px] px-1 py-0.5 rounded border opacity-70"
                        style={{ color: API_KEY_CARD_COLOR, borderColor: API_KEY_CARD_COLOR }}
                      >
                        API Key
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {playbooks.map((playbook, index) =>
                renderPlaybookCard(playbook, credentials.length + index),
              )}
              {services.map((service, index) => {
                const cardIndex = credentials.length + playbooks.length + index;
                const IconComponent = getServiceIcon(service);
                return (
                  <div
                    key={service.id}
                    className="relative transition-all duration-500 hover:z-20 hover:scale-110"
                    style={{
                      zIndex: deckCards - cardIndex,
                      transform: `rotate(${(cardIndex - deckCards / 2) * 2}deg)`,
                    }}
                  >
                    <div
                      className="w-32 h-48 aspect-[2/3] rounded-lg border-2 p-3 transform transition-all duration-500 shadow-lg hover:shadow-2xl bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden cursor-pointer hover:rotate-0"
                      style={{
                        borderColor: getServiceCardColor(service),
                        boxShadow: `0 0 20px ${getServiceCardColor(service)}20`,
                      }}
                      draggable
                      onDragStart={(e) => onDragStart(e, service, true)}
                      onDragEnd={onDragEnd}
                      onClick={() => onCardClick?.(service)}
                      data-testid={`deck-card-${service.id}`}
                    >
                      <div className="absolute top-1 left-1 text-xs font-bold">
                        <div className="leading-none" style={{ color: getServiceCardColor(service) }}>
                          {service.type === "mcp" ? "RM" : service.type === "local-mcp" ? "LM" : "A"}
                        </div>
                      </div>
                      <div className="absolute bottom-1 right-1 text-xs font-bold rotate-180">
                        <div className="leading-none" style={{ color: getServiceCardColor(service) }}>
                          {service.type === "mcp" ? "RM" : service.type === "local-mcp" ? "LM" : "A"}
                        </div>
                      </div>
                      <div className="absolute inset-x-2 top-6 bottom-8 flex flex-col items-center justify-center text-center">
                        <div className="mb-2" style={{ color: getServiceCardColor(service) }}>
                          {IconComponent}
                        </div>
                        <h3
                          className="font-bold text-xs mb-1 line-clamp-2"
                          style={{ color: getServiceCardColor(service) }}
                        >
                          {service.name}
                        </h3>
                        <div
                          className="text-[8px] px-1 py-0.5 rounded border opacity-70"
                          style={{
                            color: getServiceCardColor(service),
                            borderColor: getServiceCardColor(service),
                          }}
                        >
                          {service.type === "mcp"
                            ? "Remote MCP"
                            : service.type === "local-mcp"
                              ? "Local MCP"
                              : "A2A"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
