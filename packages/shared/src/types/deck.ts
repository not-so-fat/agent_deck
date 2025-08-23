import { Service } from './service';

export interface Deck {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  services: Service[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeckInput {
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateDeckInput {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface DeckService {
  deckId: string;
  serviceId: string;
  position: number;
}

export interface AddServiceToDeckInput {
  deckId: string;
  serviceId: string;
  position?: number;
}

export interface RemoveServiceFromDeckInput {
  deckId: string;
  serviceId: string;
}

export interface ReorderDeckServicesInput {
  deckId: string;
  serviceIds: string[]; // Ordered list of service IDs
}
