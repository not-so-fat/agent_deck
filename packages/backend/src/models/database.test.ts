import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from './database';
import { CreateServiceInput, CreateDeckInput } from '@agent-deck/shared';

describe('DatabaseManager', () => {
  let dbManager: DatabaseManager;
  const testDbPath = ':memory:'; // Use in-memory database for tests

  beforeEach(async () => {
    dbManager = new DatabaseManager(testDbPath);
    // No need to call initialize() as it's called in constructor
  });

  afterEach(async () => {
    await dbManager.close();
  });

  describe('Service Operations', () => {
    it('should create a service', async () => {
      const serviceInput: CreateServiceInput = {
        name: 'Test Service',
        type: 'mcp',
        url: 'https://example.com',
        description: 'A test service',
        cardColor: '#ff0000',
      };

      const service = await dbManager.createService(serviceInput);
      
      expect(service.id).toBeDefined();
      expect(service.name).toBe(serviceInput.name);
      expect(service.type).toBe(serviceInput.type);
      expect(service.url).toBe(serviceInput.url);
      expect(service.health).toBe('unknown');
      expect(service.isConnected).toBe(false);
      expect(service.registeredAt).toBeDefined();
      expect(service.updatedAt).toBeDefined();
    });

    it('should get a service by ID', async () => {
      const serviceInput: CreateServiceInput = {
        name: 'Test Service',
        type: 'mcp',
        url: 'https://example.com',
        cardColor: '#ff0000',
      };

      const created = await dbManager.createService(serviceInput);
      const retrieved = await dbManager.getService(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe(serviceInput.name);
    });

    it('should return null for non-existent service', async () => {
      const service = await dbManager.getService('non-existent-id');
      expect(service).toBeNull();
    });

    it('should get all services', async () => {
      const service1: CreateServiceInput = {
        name: 'Service 1',
        type: 'mcp',
        url: 'https://service1.com',
        cardColor: '#ff0000',
      };

      const service2: CreateServiceInput = {
        name: 'Service 2',
        type: 'a2a',
        url: 'https://service2.com',
        cardColor: '#00ff00',
      };

      await dbManager.createService(service1);
      await dbManager.createService(service2);

      const services = await dbManager.getAllServices();
      expect(services).toHaveLength(2);
      expect(services.map(s => s.name)).toContain('Service 1');
      expect(services.map(s => s.name)).toContain('Service 2');
    });

    it('should update a service', async () => {
      const serviceInput: CreateServiceInput = {
        name: 'Test Service',
        type: 'mcp',
        url: 'https://example.com',
        cardColor: '#ff0000',
      };

      const service = await dbManager.createService(serviceInput);
      
      const updated = await dbManager.updateService(service.id, {
        name: 'Updated Service',
        description: 'Updated description',
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Service');
      expect(updated?.description).toBe('Updated description');
      expect(updated?.url).toBe(serviceInput.url); // unchanged
    });

    it('should delete a service', async () => {
      const serviceInput: CreateServiceInput = {
        name: 'Test Service',
        type: 'mcp',
        url: 'https://example.com',
        cardColor: '#ff0000',
      };

      const service = await dbManager.createService(serviceInput);
      await dbManager.deleteService(service.id);

      const retrieved = await dbManager.getService(service.id);
      expect(retrieved).toBeNull();
    });

    it('should update service status', async () => {
      const serviceInput: CreateServiceInput = {
        name: 'Test Service',
        type: 'mcp',
        url: 'https://example.com',
        cardColor: '#ff0000',
      };

      const service = await dbManager.createService(serviceInput);
      
      await dbManager.updateServiceStatus(service.id, true, 'healthy');
      
      const updated = await dbManager.getService(service.id);
      expect(updated?.health).toBe('healthy');
      expect(updated?.isConnected).toBe(true);
    });
  });

  describe('Deck Operations', () => {
    it('should create a deck', async () => {
      const deckInput: CreateDeckInput = {
        name: 'Test Deck',
        description: 'A test deck',
      };

      const deck = await dbManager.createDeck(deckInput);
      
      expect(deck.id).toBeDefined();
      expect(deck.name).toBe(deckInput.name);
      expect(deck.description).toBe(deckInput.description);
      expect(deck.isActive).toBe(false);
      expect(deck.createdAt).toBeDefined();
      expect(deck.updatedAt).toBeDefined();
    });

    it('should get a deck by ID', async () => {
      const deckInput: CreateDeckInput = {
        name: 'Test Deck',
        description: 'A test deck',
      };

      const created = await dbManager.createDeck(deckInput);
      const retrieved = await dbManager.getDeck(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe(deckInput.name);
    });

    it('should return null for non-existent deck', async () => {
      const deck = await dbManager.getDeck('non-existent-id');
      expect(deck).toBeNull();
    });

    it('should get all decks', async () => {
      const deck1: CreateDeckInput = {
        name: 'Deck 1',
        description: 'First deck',
      };

      const deck2: CreateDeckInput = {
        name: 'Deck 2',
        description: 'Second deck',
      };

      await dbManager.createDeck(deck1);
      await dbManager.createDeck(deck2);

      const decks = await dbManager.getAllDecks();
      expect(decks).toHaveLength(2);
      expect(decks.map(d => d.name)).toContain('Deck 1');
      expect(decks.map(d => d.name)).toContain('Deck 2');
    });

    it('should get active deck', async () => {
      const deck1: CreateDeckInput = {
        name: 'Deck 1',
        description: 'First deck',
      };

      const deck2: CreateDeckInput = {
        name: 'Deck 2',
        description: 'Second deck',
      };

      await dbManager.createDeck(deck1);
      const deck2Created = await dbManager.createDeck(deck2);
      
      await dbManager.setActiveDeck(deck2Created.id);
      
      const activeDeck = await dbManager.getActiveDeck();
      expect(activeDeck).toBeDefined();
      expect(activeDeck?.id).toBe(deck2Created.id);
    });

    it('should update a deck', async () => {
      const deckInput: CreateDeckInput = {
        name: 'Test Deck',
        description: 'A test deck',
      };

      const deck = await dbManager.createDeck(deckInput);
      
      const updated = await dbManager.updateDeck(deck.id, {
        name: 'Updated Deck',
        description: 'Updated description',
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Deck');
      expect(updated?.description).toBe('Updated description');
    });

    it('should delete a deck', async () => {
      const deckInput: CreateDeckInput = {
        name: 'Test Deck',
        description: 'A test deck',
      };

      const deck = await dbManager.createDeck(deckInput);
      await dbManager.deleteDeck(deck.id);

      const retrieved = await dbManager.getDeck(deck.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Deck Service Operations', () => {
    it('should add service to deck', async () => {
      const serviceInput: CreateServiceInput = {
        name: 'Test Service',
        type: 'mcp',
        url: 'https://example.com',
        cardColor: '#ff0000',
      };

      const deckInput: CreateDeckInput = {
        name: 'Test Deck',
        description: 'A test deck',
      };

      const service = await dbManager.createService(serviceInput);
      const deck = await dbManager.createDeck(deckInput);

      await dbManager.addServiceToDeck({
        deckId: deck.id,
        serviceId: service.id,
      });

      const deckServices = await dbManager.getDeckServices(deck.id);
      expect(deckServices).toHaveLength(1);
      expect(deckServices[0].serviceId).toBe(service.id);
      expect(deckServices[0].position).toBe(0);
    });

    it('should remove service from deck', async () => {
      const serviceInput: CreateServiceInput = {
        name: 'Test Service',
        type: 'mcp',
        url: 'https://example.com',
        cardColor: '#ff0000',
      };

      const deckInput: CreateDeckInput = {
        name: 'Test Deck',
        description: 'A test deck',
      };

      const service = await dbManager.createService(serviceInput);
      const deck = await dbManager.createDeck(deckInput);

      await dbManager.addServiceToDeck({
        deckId: deck.id,
        serviceId: service.id,
      });
      await dbManager.removeServiceFromDeck({
        deckId: deck.id,
        serviceId: service.id,
      });

      const deckServices = await dbManager.getDeckServices(deck.id);
      expect(deckServices).toHaveLength(0);
    });

    it('should reorder deck services', async () => {
      const service1: CreateServiceInput = {
        name: 'Service 1',
        type: 'mcp',
        url: 'https://service1.com',
        cardColor: '#ff0000',
      };

      const service2: CreateServiceInput = {
        name: 'Service 2',
        type: 'mcp',
        url: 'https://service2.com',
        cardColor: '#00ff00',
      };

      const deckInput: CreateDeckInput = {
        name: 'Test Deck',
        description: 'A test deck',
      };

      const service1Created = await dbManager.createService(service1);
      const service2Created = await dbManager.createService(service2);
      const deck = await dbManager.createDeck(deckInput);

      await dbManager.addServiceToDeck({
        deckId: deck.id,
        serviceId: service1Created.id,
      });
      await dbManager.addServiceToDeck({
        deckId: deck.id,
        serviceId: service2Created.id,
      });

      await dbManager.reorderDeckServices({
        deckId: deck.id,
        serviceIds: [service2Created.id, service1Created.id],
      });

      const deckServices = await dbManager.getDeckServices(deck.id);
      expect(deckServices).toHaveLength(2);
      expect(deckServices[0].serviceId).toBe(service2Created.id);
      expect(deckServices[0].position).toBe(0);
      expect(deckServices[1].serviceId).toBe(service1Created.id);
      expect(deckServices[1].position).toBe(1);
    });
  });
});
