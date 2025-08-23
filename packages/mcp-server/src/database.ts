import Database from 'better-sqlite3';
import { Service, Deck } from '@agent-deck/shared';

export class MCPDatabaseManager {
  private db: Database.Database;

  constructor(dbPath: string = '/Users/yusukemuraoka/workspace/codes/agent_deck/packages/backend/agent_deck.db') {
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  private initializeTables(): void {
    // Create services table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        url TEXT NOT NULL,
        health TEXT DEFAULT 'unknown',
        description TEXT,
        card_color TEXT DEFAULT '#7ed4da',
        is_connected INTEGER DEFAULT 0,
        last_ping TEXT,
        registered_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        headers TEXT,
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

    // Create decks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS decks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        is_active INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Create deck_services table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS deck_services (
        deck_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (deck_id, service_id),
        FOREIGN KEY (deck_id) REFERENCES decks (id) ON DELETE CASCADE,
        FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
      )
    `);
  }

  async getActiveDeck(): Promise<Deck | null> {
    const stmt = this.db.prepare(`
      SELECT id, name, description, is_active, created_at, updated_at
      FROM decks WHERE is_active = 1
      LIMIT 1
    `);
    
    const row = stmt.get() as any;
    if (!row) return null;

    // Get services for this deck
    const services = await this.getDeckServices(row.id);

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

  async getDeckServices(deckId: string): Promise<Service[]> {
    const stmt = this.db.prepare(`
      SELECT s.* FROM services s
      INNER JOIN deck_services ds ON s.id = ds.service_id
      WHERE ds.deck_id = ?
      ORDER BY ds.position ASC
    `);
    
    const rows = stmt.all(deckId) as any[];
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
      headers: row.headers ? JSON.parse(row.headers) : undefined,
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

  close(): void {
    this.db.close();
  }
}
