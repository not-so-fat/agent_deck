import Database from 'better-sqlite3';
import { 
  Service, 
  CreateServiceInput, 
  UpdateServiceInput,
  Deck,
  CreateDeckInput,
  UpdateDeckInput,
  DeckService,
  AddServiceToDeckInput,
  RemoveServiceFromDeckInput,
  ReorderDeckServicesInput
} from '@agent-deck/shared';
import { 
  serializeForDatabase, 
  deserializeFromDatabase,
  generateId 
} from '@agent-deck/shared';

export class DatabaseManager {
  private db: Database.Database;

  constructor(dbPath: string = 'agent_deck.db') {
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  private initializeTables(): void {
    // Services table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('mcp', 'a2a')),
        url TEXT NOT NULL,
        health TEXT NOT NULL DEFAULT 'unknown',
        description TEXT,
        card_color TEXT NOT NULL DEFAULT '#7ed4da',
        is_connected BOOLEAN NOT NULL DEFAULT 0,
        last_ping TEXT,
        registered_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        headers TEXT,
        
        -- OAuth fields
        oauth_client_id TEXT,
        oauth_client_secret TEXT,
        oauth_authorization_url TEXT,
        oauth_token_url TEXT,
        oauth_redirect_uri TEXT,
        oauth_scope TEXT,
        oauth_access_token TEXT,
        oauth_refresh_token TEXT,
        oauth_token_expires_at TEXT,
        oauth_state TEXT
      )
    `);

    // Decks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS decks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Deck services junction table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS deck_services (
        deck_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        FOREIGN KEY (deck_id) REFERENCES decks (id) ON DELETE CASCADE,
        FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE,
        PRIMARY KEY (deck_id, service_id)
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_services_type ON services(type);
      CREATE INDEX IF NOT EXISTS idx_services_connected ON services(is_connected);
      CREATE INDEX IF NOT EXISTS idx_decks_active ON decks(is_active);
      CREATE INDEX IF NOT EXISTS idx_deck_services_position ON deck_services(position);
    `);
  }

  // Service operations
  async createService(input: CreateServiceInput): Promise<Service> {
    const now = new Date().toISOString();
    const service: Service = {
      id: generateId(),
      ...input,
      health: 'unknown',
      cardColor: input.cardColor || '#7ed4da',
      isConnected: false,
      lastPing: undefined,
      registeredAt: now,
      updatedAt: now,
      headers: input.headers,
      oauthClientId: input.oauthClientId,
      oauthClientSecret: input.oauthClientSecret,
      oauthAuthorizationUrl: input.oauthAuthorizationUrl,
      oauthTokenUrl: input.oauthTokenUrl,
      oauthRedirectUri: input.oauthRedirectUri,
      oauthScope: input.oauthScope,
      oauthAccessToken: undefined,
      oauthRefreshToken: undefined,
      oauthTokenExpiresAt: undefined,
      oauthState: undefined,
    };

    const stmt = this.db.prepare(`
      INSERT INTO services (
        id, name, type, url, health, description, card_color, is_connected,
        registered_at, updated_at, headers,
        oauth_client_id, oauth_client_secret, oauth_authorization_url,
        oauth_token_url, oauth_redirect_uri, oauth_scope
      ) VALUES (
        @id, @name, @type, @url, @health, @description, @card_color, @is_connected,
        @registered_at, @updated_at, @headers,
        @oauth_client_id, @oauth_client_secret, @oauth_authorization_url,
        @oauth_token_url, @oauth_redirect_uri, @oauth_scope
      )
    `);

    stmt.run({
      id: service.id,
      name: service.name,
      type: service.type,
      url: service.url,
      health: service.health,
      description: service.description,
      card_color: service.cardColor,
      is_connected: service.isConnected ? 1 : 0,
      registered_at: service.registeredAt,
      updated_at: service.updatedAt,
      headers: service.headers ? JSON.stringify(service.headers) : null,
      oauth_client_id: service.oauthClientId,
      oauth_client_secret: service.oauthClientSecret,
      oauth_authorization_url: service.oauthAuthorizationUrl,
      oauth_token_url: service.oauthTokenUrl,
      oauth_redirect_uri: service.oauthRedirectUri,
      oauth_scope: service.oauthScope,
    });

    return service;
  }

  async getService(id: string): Promise<Service | null> {
    const stmt = this.db.prepare('SELECT * FROM services WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      url: row.url,
      health: row.health,
      description: row.description,
      cardColor: row.card_color,
      isConnected: Boolean(row.is_connected),
      lastPing: row.last_ping,
      registeredAt: row.registered_at,
      updatedAt: row.updated_at,
      headers: row.headers ? JSON.parse(row.headers) : null,
      oauthClientId: row.oauth_client_id,
      oauthClientSecret: row.oauth_client_secret,
      oauthAuthorizationUrl: row.oauth_authorization_url,
      oauthTokenUrl: row.oauth_token_url,
      oauthRedirectUri: row.oauth_redirect_uri,
      oauthScope: row.oauth_scope,
      oauthAccessToken: row.oauth_access_token,
      oauthRefreshToken: row.oauth_refresh_token,
      oauthTokenExpiresAt: row.oauth_token_expires_at,
      oauthState: row.oauth_state,
    };
  }

  async getAllServices(): Promise<Service[]> {
    const stmt = this.db.prepare('SELECT * FROM services ORDER BY registered_at DESC');
    const rows = stmt.all() as any[];
    
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      type: row.type,
      url: row.url,
      health: row.health,
      description: row.description,
      cardColor: row.card_color,
      isConnected: Boolean(row.is_connected),
      lastPing: row.last_ping,
      registeredAt: row.registered_at,
      updatedAt: row.updated_at,
      headers: row.headers ? JSON.parse(row.headers) : null,
      oauthClientId: row.oauth_client_id,
      oauthClientSecret: row.oauth_client_secret,
      oauthAuthorizationUrl: row.oauth_authorization_url,
      oauthTokenUrl: row.oauth_token_url,
      oauthRedirectUri: row.oauth_redirect_uri,
      oauthScope: row.oauth_scope,
      oauthAccessToken: row.oauth_access_token,
      oauthRefreshToken: row.oauth_refresh_token,
      oauthTokenExpiresAt: row.oauth_token_expires_at,
      oauthState: row.oauth_state,
    }));
  }

  async updateService(id: string, input: UpdateServiceInput): Promise<Service | null> {
    const existing = await this.getService(id);
    if (!existing) return null;

    const updated: Service = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    const stmt = this.db.prepare(`
      UPDATE services SET
        name = @name, description = @description, card_color = @card_color,
        updated_at = @updated_at, headers = @headers,
        oauth_client_id = @oauth_client_id, oauth_client_secret = @oauth_client_secret,
        oauth_authorization_url = @oauth_authorization_url, oauth_token_url = @oauth_token_url,
        oauth_redirect_uri = @oauth_redirect_uri, oauth_scope = @oauth_scope
      WHERE id = @id
    `);

    stmt.run({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      card_color: updated.cardColor,
      updated_at: updated.updatedAt,
      headers: updated.headers ? JSON.stringify(updated.headers) : null,
      oauth_client_id: updated.oauthClientId,
      oauth_client_secret: updated.oauthClientSecret,
      oauth_authorization_url: updated.oauthAuthorizationUrl,
      oauth_token_url: updated.oauthTokenUrl,
      oauth_redirect_uri: updated.oauthRedirectUri,
      oauth_scope: updated.oauthScope,
    });

    return updated;
  }

  async deleteService(id: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM services WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  async updateServiceStatus(id: string, isConnected: boolean, health: string, lastPing?: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE services SET
        is_connected = @is_connected,
        health = @health,
        last_ping = @last_ping,
        updated_at = @updated_at
      WHERE id = @id
    `);

    stmt.run({
      id,
      is_connected: isConnected ? 1 : 0,
      health,
      last_ping: lastPing,
      updated_at: new Date().toISOString(),
    });
  }

  async updateOAuthTokens(
    id: string, 
    accessToken: string, 
    refreshToken?: string, 
    expiresAt?: string
  ): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE services SET
        oauth_access_token = @oauth_access_token,
        oauth_refresh_token = @oauth_refresh_token,
        oauth_token_expires_at = @oauth_token_expires_at,
        updated_at = @updated_at
      WHERE id = @id
    `);

    stmt.run({
      id,
      oauth_access_token: accessToken,
      oauth_refresh_token: refreshToken,
      oauth_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });
  }

  // Deck operations
  async createDeck(input: CreateDeckInput): Promise<Deck> {
    const now = new Date().toISOString();
    const deck: Deck = {
      id: generateId(),
      name: input.name,
      description: input.description,
      isActive: input.isActive || false,
      services: [],
      createdAt: now,
      updatedAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO decks (id, name, description, is_active, created_at, updated_at)
      VALUES (@id, @name, @description, @is_active, @created_at, @updated_at)
    `);

    stmt.run({
      id: deck.id,
      name: deck.name,
      description: deck.description,
      is_active: deck.isActive ? 1 : 0,
      created_at: deck.createdAt,
      updated_at: deck.updatedAt,
    });

    return deck;
  }

  async getDeck(id: string): Promise<Deck | null> {
    const stmt = this.db.prepare('SELECT * FROM decks WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return null;
    
    const deckServices = await this.getDeckServices(id);
    const services: Service[] = [];
    
    for (const deckService of deckServices) {
      const service = await this.getService(deckService.serviceId);
      if (service) {
        services.push(service);
      }
    }
    
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      isActive: Boolean(row.is_active),
      services,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getAllDecks(): Promise<Deck[]> {
    const stmt = this.db.prepare('SELECT * FROM decks ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    
    const decks: Deck[] = [];
    for (const row of rows) {
      const deckServices = await this.getDeckServices(row.id);
      const services: Service[] = [];
      
      for (const deckService of deckServices) {
        const service = await this.getService(deckService.serviceId);
        if (service) {
          services.push(service);
        }
      }
      
      decks.push({
        id: row.id,
        name: row.name,
        description: row.description,
        isActive: Boolean(row.is_active),
        services,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }
    
    return decks;
  }

  async getActiveDeck(): Promise<Deck | null> {
    const stmt = this.db.prepare('SELECT * FROM decks WHERE is_active = 1 LIMIT 1');
    const row = stmt.get() as any;
    
    if (!row) return null;
    
    const deckServices = await this.getDeckServices(row.id);
    const services: Service[] = [];
    
    for (const deckService of deckServices) {
      const service = await this.getService(deckService.serviceId);
      if (service) {
        services.push(service);
      }
    }
    
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      isActive: Boolean(row.is_active),
      services,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async updateDeck(id: string, input: UpdateDeckInput): Promise<Deck | null> {
    const existing = await this.getDeck(id);
    if (!existing) return null;

    const updated: Deck = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    const stmt = this.db.prepare(`
      UPDATE decks SET
        name = @name, description = @description, is_active = @is_active, updated_at = @updated_at
      WHERE id = @id
    `);

    stmt.run({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      is_active: updated.isActive ? 1 : 0,
      updated_at: updated.updatedAt,
    });

    return updated;
  }

  async deleteDeck(id: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM decks WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  async setActiveDeck(id: string): Promise<void> {
    // First, deactivate all decks
    this.db.prepare('UPDATE decks SET is_active = 0').run();
    
    // Then activate the specified deck
    this.db.prepare('UPDATE decks SET is_active = 1 WHERE id = ?').run(id);
  }

  // Deck services operations
  async getDeckServices(deckId: string): Promise<DeckService[]> {
    const stmt = this.db.prepare(`
      SELECT deck_id, service_id, position FROM deck_services
      WHERE deck_id = ?
      ORDER BY position ASC
    `);
    
    const rows = stmt.all(deckId) as any[];
    return rows.map(row => ({
      deckId: row.deck_id,
      serviceId: row.service_id,
      position: row.position,
    }));
  }

  async addServiceToDeck(input: AddServiceToDeckInput): Promise<void> {
    // Get the next position
    const positionStmt = this.db.prepare(`
      SELECT COALESCE(MAX(position), -1) + 1 as next_position
      FROM deck_services WHERE deck_id = ?
    `);
    const positionResult = positionStmt.get(input.deckId) as any;
    const position = input.position ?? positionResult.next_position;

    const stmt = this.db.prepare(`
      INSERT INTO deck_services (deck_id, service_id, position)
      VALUES (@deck_id, @service_id, @position)
    `);

    stmt.run({
      deck_id: input.deckId,
      service_id: input.serviceId,
      position,
    });
  }

  async removeServiceFromDeck(input: RemoveServiceFromDeckInput): Promise<void> {
    const stmt = this.db.prepare(`
      DELETE FROM deck_services 
      WHERE deck_id = @deck_id AND service_id = @service_id
    `);

    stmt.run({
      deck_id: input.deckId,
      service_id: input.serviceId,
    });
  }

  async reorderDeckServices(input: ReorderDeckServicesInput): Promise<void> {
    const transaction = this.db.transaction(() => {
      // Remove all services from the deck
      this.db.prepare('DELETE FROM deck_services WHERE deck_id = ?').run(input.deckId);
      
      // Add them back in the new order
      const insertStmt = this.db.prepare(`
        INSERT INTO deck_services (deck_id, service_id, position)
        VALUES (@deck_id, @service_id, @position)
      `);
      
      input.serviceIds.forEach((serviceId, index) => {
        insertStmt.run({
          deck_id: input.deckId,
          service_id: serviceId,
          position: index,
        });
      });
    });

    transaction();
  }

  async clearDeckServices(deckId: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM deck_services WHERE deck_id = ?');
    stmt.run(deckId);
  }

  // Cleanup
  close(): void {
    this.db.close();
  }
}
