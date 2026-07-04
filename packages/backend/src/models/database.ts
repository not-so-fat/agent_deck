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
  ReorderDeckServicesInput,
  Credential,
  AddCredentialToDeckInput,
  RemoveCredentialFromDeckInput,
  DeckCredential,
  ExecRun,
  Playbook,
  CreatePlaybookInput,
  UpdatePlaybookInput,
  AddPlaybookToDeckInput,
  RemovePlaybookFromDeckInput,
  DeckPlaybook,
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
    this.createTables();
    this.migrate();
    this.createIndexes();
  }

  private tableExists(tableName: string): boolean {
    const row = this.db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName);
    return row !== undefined;
  }

  private addColumnIfMissing(tableName: string, columnName: string, definition: string): void {
    if (!this.tableExists(tableName)) {
      return;
    }

    const columns = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === columnName)) {
      this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
  }

  private indexExists(indexName: string): boolean {
    const row = this.db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?")
      .get(indexName);
    return row !== undefined;
  }

  /**
   * Rename duplicate display names so a UNIQUE index can be applied.
   * Keeps the oldest row's name; suffixes later rows with " (imported N)".
   */
  private dedupeDisplayNames(
    table: 'decks' | 'credentials',
    column: 'name' | 'label',
  ): void {
    if (!this.tableExists(table)) {
      return;
    }

    const rows = this.db
      .prepare(
        `SELECT id, ${column} AS display_name FROM ${table} ORDER BY created_at ASC, id ASC`,
      )
      .all() as Array<{ id: string; display_name: string }>;

    const used = new Set<string>();
    const update = this.db.prepare(
      `UPDATE ${table} SET ${column} = @value WHERE id = @id`,
    );

    for (const row of rows) {
      const base = row.display_name?.trim() || (table === 'decks' ? 'Deck' : 'Key');
      if (!used.has(base)) {
        used.add(base);
        if (base !== row.display_name) {
          update.run({ id: row.id, value: base });
        }
        continue;
      }

      let candidate = `${base} (imported)`;
      let n = 2;
      while (used.has(candidate)) {
        candidate = `${base} (imported ${n})`;
        n += 1;
      }
      used.add(candidate);
      update.run({ id: row.id, value: candidate });
    }
  }

  private ensureUniqueDisplayNameIndex(
    table: 'decks' | 'credentials',
    column: 'name' | 'label',
    indexName: string,
  ): void {
    if (!this.tableExists(table) || this.indexExists(indexName)) {
      return;
    }
    this.dedupeDisplayNames(table, column);
    this.db.exec(
      `CREATE UNIQUE INDEX ${indexName} ON ${table} (${column})`,
    );
  }

  private migrate(): void {
    this.addColumnIfMissing('services', 'is_connected', 'BOOLEAN NOT NULL DEFAULT 0');
    this.addColumnIfMissing('services', 'last_ping', 'TEXT');
    this.addColumnIfMissing('services', 'credential_id', 'TEXT');
    this.addColumnIfMissing('services', 'icon_url', 'TEXT');
    this.addColumnIfMissing('services', 'disabled_tools', "TEXT NOT NULL DEFAULT '[]'");
    this.addColumnIfMissing('services', 'oauth_client_id', 'TEXT');
    this.addColumnIfMissing('services', 'oauth_client_secret', 'TEXT');
    this.addColumnIfMissing('services', 'oauth_authorization_url', 'TEXT');
    this.addColumnIfMissing('services', 'oauth_token_url', 'TEXT');
    this.addColumnIfMissing('services', 'oauth_redirect_uri', 'TEXT');
    this.addColumnIfMissing('services', 'oauth_scope', 'TEXT');
    this.addColumnIfMissing('services', 'oauth_access_token', 'TEXT');
    this.addColumnIfMissing('services', 'oauth_refresh_token', 'TEXT');
    this.addColumnIfMissing('services', 'oauth_token_expires_at', 'TEXT');
    this.addColumnIfMissing('services', 'oauth_has_token', 'BOOLEAN NOT NULL DEFAULT 0');
    this.addColumnIfMissing('services', 'oauth_state', 'TEXT');
    this.addColumnIfMissing('services', 'local_command', 'TEXT');
    this.addColumnIfMissing('services', 'local_args', 'TEXT');
    this.addColumnIfMissing('services', 'local_working_dir', 'TEXT');
    this.addColumnIfMissing('services', 'local_env', 'TEXT');

    this.addColumnIfMissing('credentials', 'docs_url', 'TEXT');
    this.addColumnIfMissing('credentials', 'icon_url', 'TEXT');

    // Display names are how users/agents distinguish cards and decks (not UUIDs).
    this.ensureUniqueDisplayNameIndex('decks', 'name', 'decks_name_unique');
    this.ensureUniqueDisplayNameIndex('credentials', 'label', 'credentials_label_unique');
  }

  private createTables(): void {
    // Services table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL CHECK (type IN ('mcp', 'a2a', 'local-mcp')),
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
        oauth_state TEXT,
        
        -- Local MCP server fields
        local_command TEXT,
        local_args TEXT,
        local_working_dir TEXT,
        local_env TEXT
      )
    `);

    // Decks table (name UNIQUE via decks_name_unique index — see migrate())
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

    // Credentials table (metadata only — secrets in Keychain; label UNIQUE via index)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS credentials (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        scheme TEXT NOT NULL CHECK (scheme IN ('bearer', 'header', 'http_basic_user')),
        header_name TEXT,
        env_name TEXT NOT NULL,
        keychain_account TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Deck credentials junction table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS deck_credentials (
        deck_id TEXT NOT NULL,
        credential_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        FOREIGN KEY (deck_id) REFERENCES decks (id) ON DELETE CASCADE,
        FOREIGN KEY (credential_id) REFERENCES credentials (id) ON DELETE CASCADE,
        PRIMARY KEY (deck_id, credential_id)
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS playbooks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL UNIQUE,
        body TEXT NOT NULL DEFAULT '',
        triggers TEXT NOT NULL DEFAULT '[]',
        depends_on_credentials TEXT NOT NULL DEFAULT '[]',
        depends_on_services TEXT NOT NULL DEFAULT '[]',
        exec_command TEXT,
        skill_path TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS deck_playbooks (
        deck_id TEXT NOT NULL,
        playbook_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        FOREIGN KEY (deck_id) REFERENCES decks (id) ON DELETE CASCADE,
        FOREIGN KEY (playbook_id) REFERENCES playbooks (id) ON DELETE CASCADE,
        PRIMARY KEY (deck_id, playbook_id)
      )
    `);

    // Exec audit log (credential ids only, never secret values)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS exec_runs (
        id TEXT PRIMARY KEY,
        deck_id TEXT,
        manifest_path TEXT,
        command TEXT NOT NULL,
        exit_code INTEGER,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        FOREIGN KEY (deck_id) REFERENCES decks (id) ON DELETE SET NULL
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS exec_run_credentials (
        exec_run_id TEXT NOT NULL,
        credential_id TEXT NOT NULL,
        FOREIGN KEY (exec_run_id) REFERENCES exec_runs (id) ON DELETE CASCADE,
        FOREIGN KEY (credential_id) REFERENCES credentials (id) ON DELETE CASCADE,
        PRIMARY KEY (exec_run_id, credential_id)
      )
    `);
  }

  hasAnyServices(): boolean {
    const row = this.db.prepare('SELECT 1 FROM services LIMIT 1').get();
    return row !== undefined;
  }

  private createIndexes(): void {
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_services_type ON services(type);
      CREATE INDEX IF NOT EXISTS idx_services_connected ON services(is_connected);
      CREATE INDEX IF NOT EXISTS idx_decks_active ON decks(is_active);
      CREATE INDEX IF NOT EXISTS idx_deck_services_position ON deck_services(position);
      CREATE INDEX IF NOT EXISTS idx_credentials_env_name ON credentials(env_name);
      CREATE INDEX IF NOT EXISTS idx_deck_credentials_position ON deck_credentials(position);
      CREATE INDEX IF NOT EXISTS idx_deck_playbooks_position ON deck_playbooks(position);
      CREATE INDEX IF NOT EXISTS idx_exec_runs_started_at ON exec_runs(started_at);
    `);
  }

  private mapCredentialRow(row: any): Credential {
    return {
      id: row.id,
      label: row.label,
      scheme: row.scheme,
      headerName: row.header_name ?? undefined,
      envName: row.env_name,
      keychainAccount: row.keychain_account,
      tags: row.tags ? JSON.parse(row.tags) : [],
      docsUrl: row.docs_url ?? undefined,
      iconUrl: row.icon_url ?? undefined,
      hasSecret: false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getDeckCredentialsForDeck(deckId: string): Promise<Credential[]> {
    const stmt = this.db.prepare(`
      SELECT c.*, dc.position
      FROM deck_credentials dc
      JOIN credentials c ON c.id = dc.credential_id
      WHERE dc.deck_id = ?
      ORDER BY dc.position ASC
    `);

    const rows = stmt.all(deckId) as any[];
    return rows.map((row) => this.mapCredentialRow(row));
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
      localCommand: input.localCommand,
      localArgs: input.localArgs,
      localWorkingDir: input.localWorkingDir,
      localEnv: input.localEnv,
      credentialId: input.credentialId,
      iconUrl: input.iconUrl,
      disabledToolNames: [],
    };

    const stmt = this.db.prepare(`
      INSERT INTO services (
        id, name, type, url, health, description, card_color, is_connected,
        registered_at, updated_at, headers, credential_id, icon_url,
        oauth_client_id, oauth_client_secret, oauth_authorization_url,
        oauth_token_url, oauth_redirect_uri, oauth_scope,
        local_command, local_args, local_working_dir, local_env
      ) VALUES (
        @id, @name, @type, @url, @health, @description, @card_color, @is_connected,
        @registered_at, @updated_at, @headers, @credential_id, @icon_url,
        @oauth_client_id, @oauth_client_secret, @oauth_authorization_url,
        @oauth_token_url, @oauth_redirect_uri, @oauth_scope,
        @local_command, @local_args, @local_working_dir, @local_env
      )
    `);

    try {
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
        credential_id: service.credentialId ?? null,
        icon_url: service.iconUrl ?? null,
        oauth_client_id: service.oauthClientId,
        oauth_client_secret: service.oauthClientSecret,
        oauth_authorization_url: service.oauthAuthorizationUrl,
        oauth_token_url: service.oauthTokenUrl,
        oauth_redirect_uri: service.oauthRedirectUri,
        oauth_scope: service.oauthScope,
        local_command: service.localCommand,
        local_args: service.localArgs ? JSON.stringify(service.localArgs) : null,
        local_working_dir: service.localWorkingDir,
        local_env: service.localEnv ? JSON.stringify(service.localEnv) : null,
      });
    } catch (error) {
      this.throwIfUniqueConstraint(error, 'service', 'name');
    }

    return service;
  }

  private mapServiceRow(row: any): Service {
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
      oauthHasToken: Boolean(row.oauth_has_token),
      oauthState: row.oauth_state,
      localCommand: row.local_command,
      localArgs: row.local_args ? JSON.parse(row.local_args) : null,
      localWorkingDir: row.local_working_dir,
      localEnv: row.local_env ? JSON.parse(row.local_env) : null,
      credentialId: row.credential_id ?? undefined,
      iconUrl: row.icon_url ?? undefined,
      disabledToolNames: row.disabled_tools ? JSON.parse(row.disabled_tools) : [],
    };
  }

  async getService(id: string): Promise<Service | null> {
    const stmt = this.db.prepare('SELECT * FROM services WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return null;
    
    return this.mapServiceRow(row);
  }

  async getAllServices(): Promise<Service[]> {
    const stmt = this.db.prepare('SELECT * FROM services ORDER BY registered_at DESC');
    const rows = stmt.all() as any[];
    
    return rows.map((row) => this.mapServiceRow(row));
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
        updated_at = @updated_at, headers = @headers, credential_id = @credential_id,
        icon_url = @icon_url,
        oauth_client_id = @oauth_client_id, oauth_client_secret = @oauth_client_secret,
        oauth_authorization_url = @oauth_authorization_url, oauth_token_url = @oauth_token_url,
        oauth_redirect_uri = @oauth_redirect_uri, oauth_scope = @oauth_scope,
        local_command = @local_command, local_args = @local_args,
        local_working_dir = @local_working_dir, local_env = @local_env
      WHERE id = @id
    `);

    stmt.run({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      card_color: updated.cardColor,
      updated_at: updated.updatedAt,
      headers: updated.headers ? JSON.stringify(updated.headers) : null,
      credential_id: updated.credentialId ?? null,
      icon_url: updated.iconUrl ?? null,
      oauth_client_id: updated.oauthClientId,
      oauth_client_secret: updated.oauthClientSecret,
      oauth_authorization_url: updated.oauthAuthorizationUrl,
      oauth_token_url: updated.oauthTokenUrl,
      oauth_redirect_uri: updated.oauthRedirectUri,
      oauth_scope: updated.oauthScope,
      local_command: updated.localCommand,
      local_args: updated.localArgs ? JSON.stringify(updated.localArgs) : null,
      local_working_dir: updated.localWorkingDir,
      local_env: updated.localEnv ? JSON.stringify(updated.localEnv) : null,
    });

    return updated;
  }

  async updateServiceDisabledTools(id: string, disabledTools: string[]): Promise<Service | null> {
    const existing = await this.getService(id);
    if (!existing) {
      return null;
    }

    const stmt = this.db.prepare(`
      UPDATE services SET
        disabled_tools = @disabled_tools,
        updated_at = @updated_at
      WHERE id = @id
    `);

    stmt.run({
      id,
      disabled_tools: JSON.stringify(disabledTools),
      updated_at: new Date().toISOString(),
    });

    return this.getService(id);
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

  /** Clears legacy token columns; secrets live in OAuthTokenVault. */
  async clearOAuthTokensFromDb(
    id: string,
    options: { expiresAt?: string | null; hasToken?: boolean } = {},
  ): Promise<void> {
    const service = await this.getService(id);
    let headers = service?.headers ? { ...service.headers } : null;
    if (headers?.Authorization) {
      delete headers.Authorization;
      if (Object.keys(headers).length === 0) {
        headers = null;
      }
    }

    const fields = [
      'oauth_access_token = NULL',
      'oauth_refresh_token = NULL',
      'headers = @headers',
      'updated_at = @updated_at',
    ];
    const params: Record<string, unknown> = {
      id,
      headers: headers ? JSON.stringify(headers) : null,
      updated_at: new Date().toISOString(),
    };

    if (options.expiresAt !== undefined) {
      fields.push('oauth_token_expires_at = @oauth_token_expires_at');
      params.oauth_token_expires_at = options.expiresAt;
    }
    if (options.hasToken !== undefined) {
      fields.push('oauth_has_token = @oauth_has_token');
      params.oauth_has_token = options.hasToken ? 1 : 0;
    }

    const stmt = this.db.prepare(`
      UPDATE services SET ${fields.join(', ')} WHERE id = @id
    `);
    stmt.run(params);
  }

  private throwIfUniqueConstraint(
    error: unknown,
    entity: string,
    field: string,
  ): never {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code: unknown }).code)
        : '';
    const message = error instanceof Error ? error.message : String(error);
    if (
      code.includes('CONSTRAINT') ||
      message.includes('UNIQUE constraint failed')
    ) {
      throw new Error(`A ${entity} with that ${field} already exists`);
    }
    throw error;
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
      credentials: [],
      playbooks: [],
      createdAt: now,
      updatedAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO decks (id, name, description, is_active, created_at, updated_at)
      VALUES (@id, @name, @description, @is_active, @created_at, @updated_at)
    `);

    try {
      stmt.run({
        id: deck.id,
        name: deck.name,
        description: deck.description,
        is_active: deck.isActive ? 1 : 0,
        created_at: deck.createdAt,
        updated_at: deck.updatedAt,
      });
    } catch (error) {
      this.throwIfUniqueConstraint(error, 'deck', 'name');
    }

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

    const credentials = await this.getDeckCredentialsForDeck(id);
    const playbooks = await this.getDeckPlaybooksForDeck(id);
    
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      isActive: Boolean(row.is_active),
      services,
      credentials,
      playbooks,
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

      const credentials = await this.getDeckCredentialsForDeck(row.id);
      const playbooks = await this.getDeckPlaybooksForDeck(row.id);
      
      decks.push({
        id: row.id,
        name: row.name,
        description: row.description,
        isActive: Boolean(row.is_active),
        services,
        credentials,
        playbooks,
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

    const credentials = await this.getDeckCredentialsForDeck(row.id);
    const playbooks = await this.getDeckPlaybooksForDeck(row.id);
    
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      isActive: Boolean(row.is_active),
      services,
      credentials,
      playbooks,
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

    try {
      stmt.run({
        id: updated.id,
        name: updated.name,
        description: updated.description,
        is_active: updated.isActive ? 1 : 0,
        updated_at: updated.updatedAt,
      });
    } catch (error) {
      this.throwIfUniqueConstraint(error, 'deck', 'name');
    }

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

  // Credential operations
  async createCredential(input: Omit<Credential, 'createdAt' | 'updatedAt'>): Promise<Credential> {
    const now = new Date().toISOString();
    const credential: Credential = {
      ...input,
      createdAt: now,
      updatedAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO credentials (
        id, label, scheme, header_name, env_name, keychain_account, tags, docs_url, icon_url, created_at, updated_at
      ) VALUES (
        @id, @label, @scheme, @header_name, @env_name, @keychain_account, @tags, @docs_url, @icon_url, @created_at, @updated_at
      )
    `);

    try {
      stmt.run({
        id: credential.id,
        label: credential.label,
        scheme: credential.scheme,
        header_name: credential.headerName ?? null,
        env_name: credential.envName,
        keychain_account: credential.keychainAccount,
        tags: JSON.stringify(credential.tags ?? []),
        docs_url: credential.docsUrl ?? null,
        icon_url: credential.iconUrl ?? null,
        created_at: credential.createdAt,
        updated_at: credential.updatedAt,
      });
    } catch (error) {
      this.throwIfUniqueConstraint(error, 'credential', 'label or id');
    }

    return credential;
  }

  async getCredential(id: string): Promise<Credential | null> {
    const stmt = this.db.prepare('SELECT * FROM credentials WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) {
      return null;
    }
    return this.mapCredentialRow(row);
  }

  async getAllCredentials(): Promise<Credential[]> {
    const stmt = this.db.prepare('SELECT * FROM credentials ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    return rows.map((row) => this.mapCredentialRow(row));
  }

  async updateCredential(id: string, input: Partial<Credential>): Promise<Credential | null> {
    const existing = await this.getCredential(id);
    if (!existing) {
      return null;
    }

    const updated: Credential = {
      ...existing,
      ...input,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };

    const stmt = this.db.prepare(`
      UPDATE credentials SET
        label = @label,
        scheme = @scheme,
        header_name = @header_name,
        env_name = @env_name,
        keychain_account = @keychain_account,
        tags = @tags,
        docs_url = @docs_url,
        icon_url = @icon_url,
        updated_at = @updated_at
      WHERE id = @id
    `);

    stmt.run({
      id: updated.id,
      label: updated.label,
      scheme: updated.scheme,
      header_name: updated.headerName ?? null,
      env_name: updated.envName,
      keychain_account: updated.keychainAccount,
      tags: JSON.stringify(updated.tags ?? []),
      docs_url: updated.docsUrl ?? null,
      icon_url: updated.iconUrl ?? null,
      updated_at: updated.updatedAt,
    });

    return updated;
  }

  async touchCredential(id: string): Promise<void> {
    this.db.prepare('UPDATE credentials SET updated_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      id,
    );
  }

  async deleteCredential(id: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM credentials WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  async getDeckCredentials(deckId: string): Promise<DeckCredential[]> {
    const stmt = this.db.prepare(`
      SELECT deck_id, credential_id, position FROM deck_credentials
      WHERE deck_id = ?
      ORDER BY position ASC
    `);

    const rows = stmt.all(deckId) as any[];
    return rows.map((row) => ({
      deckId: row.deck_id,
      credentialId: row.credential_id,
      position: row.position,
    }));
  }

  async addCredentialToDeck(input: AddCredentialToDeckInput): Promise<void> {
    const positionStmt = this.db.prepare(`
      SELECT COALESCE(MAX(position), -1) + 1 as next_position
      FROM deck_credentials WHERE deck_id = ?
    `);
    const positionResult = positionStmt.get(input.deckId) as any;
    const position = input.position ?? positionResult.next_position;

    const stmt = this.db.prepare(`
      INSERT INTO deck_credentials (deck_id, credential_id, position)
      VALUES (@deck_id, @credential_id, @position)
    `);

    stmt.run({
      deck_id: input.deckId,
      credential_id: input.credentialId,
      position,
    });
  }

  async removeCredentialFromDeck(input: RemoveCredentialFromDeckInput): Promise<void> {
    const stmt = this.db.prepare(`
      DELETE FROM deck_credentials
      WHERE deck_id = @deck_id AND credential_id = @credential_id
    `);

    stmt.run({
      deck_id: input.deckId,
      credential_id: input.credentialId,
    });
  }

  async createExecRun(input: {
    deckId?: string;
    manifestPath?: string;
    command: string;
    credentialIds: string[];
    exitCode?: number;
    startedAt: string;
    finishedAt?: string;
  }): Promise<ExecRun> {
    const execRun: ExecRun = {
      id: generateId(),
      deckId: input.deckId,
      manifestPath: input.manifestPath,
      command: input.command,
      credentialIds: input.credentialIds,
      exitCode: input.exitCode,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
    };

    const insertRun = this.db.prepare(`
      INSERT INTO exec_runs (
        id, deck_id, manifest_path, command, exit_code, started_at, finished_at
      ) VALUES (
        @id, @deck_id, @manifest_path, @command, @exit_code, @started_at, @finished_at
      )
    `);

    const insertCredential = this.db.prepare(`
      INSERT INTO exec_run_credentials (exec_run_id, credential_id)
      VALUES (@exec_run_id, @credential_id)
    `);

    const transaction = this.db.transaction(() => {
      insertRun.run({
        id: execRun.id,
        deck_id: execRun.deckId ?? null,
        manifest_path: execRun.manifestPath ?? null,
        command: execRun.command,
        exit_code: execRun.exitCode ?? null,
        started_at: execRun.startedAt,
        finished_at: execRun.finishedAt ?? null,
      });

      for (const credentialId of input.credentialIds) {
        insertCredential.run({
          exec_run_id: execRun.id,
          credential_id: credentialId,
        });
      }
    });

    transaction();
    return execRun;
  }

  private mapPlaybookRow(row: any): Playbook {
    return {
      id: row.id,
      title: row.title,
      body: row.body ?? '',
      triggers: row.triggers ? JSON.parse(row.triggers) : [],
      dependsOnCredentialIds: row.depends_on_credentials
        ? JSON.parse(row.depends_on_credentials)
        : [],
      dependsOnServiceIds: row.depends_on_services ? JSON.parse(row.depends_on_services) : [],
      exec: row.exec_command ?? undefined,
      skill: row.skill_path ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async createPlaybook(input: CreatePlaybookInput & { id: string }): Promise<Playbook> {
    const now = new Date().toISOString();
    const playbook: Playbook = {
      id: input.id,
      title: input.title,
      body: input.body ?? '',
      triggers: input.triggers ?? [],
      dependsOnCredentialIds: input.dependsOnCredentialIds ?? [],
      dependsOnServiceIds: input.dependsOnServiceIds ?? [],
      exec: input.exec,
      skill: input.skill,
      createdAt: now,
      updatedAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO playbooks (
        id, title, body, triggers, depends_on_credentials, depends_on_services,
        exec_command, skill_path, created_at, updated_at
      ) VALUES (
        @id, @title, @body, @triggers, @depends_on_credentials, @depends_on_services,
        @exec_command, @skill_path, @created_at, @updated_at
      )
    `);

    try {
      stmt.run({
        id: playbook.id,
        title: playbook.title,
        body: playbook.body,
        triggers: JSON.stringify(playbook.triggers),
        depends_on_credentials: JSON.stringify(playbook.dependsOnCredentialIds),
        depends_on_services: JSON.stringify(playbook.dependsOnServiceIds),
        exec_command: playbook.exec ?? null,
        skill_path: playbook.skill ?? null,
        created_at: playbook.createdAt,
        updated_at: playbook.updatedAt,
      });
    } catch (error) {
      this.throwIfUniqueConstraint(error, 'playbook', 'title or id');
    }

    return playbook;
  }

  async getPlaybook(id: string): Promise<Playbook | null> {
    const row = this.db.prepare('SELECT * FROM playbooks WHERE id = ?').get(id) as any;
    return row ? this.mapPlaybookRow(row) : null;
  }

  async getAllPlaybooks(): Promise<Playbook[]> {
    const rows = this.db.prepare('SELECT * FROM playbooks ORDER BY created_at DESC').all() as any[];
    return rows.map((row) => this.mapPlaybookRow(row));
  }

  async updatePlaybook(id: string, input: UpdatePlaybookInput): Promise<Playbook | null> {
    const existing = await this.getPlaybook(id);
    if (!existing) {
      return null;
    }

    const updated: Playbook = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    this.db.prepare(`
      UPDATE playbooks SET
        title = @title,
        body = @body,
        triggers = @triggers,
        depends_on_credentials = @depends_on_credentials,
        depends_on_services = @depends_on_services,
        exec_command = @exec_command,
        skill_path = @skill_path,
        updated_at = @updated_at
      WHERE id = @id
    `).run({
      id: updated.id,
      title: updated.title,
      body: updated.body,
      triggers: JSON.stringify(updated.triggers),
      depends_on_credentials: JSON.stringify(updated.dependsOnCredentialIds),
      depends_on_services: JSON.stringify(updated.dependsOnServiceIds),
      exec_command: updated.exec ?? null,
      skill_path: updated.skill ?? null,
      updated_at: updated.updatedAt,
    });

    return updated;
  }

  async deletePlaybook(id: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM playbooks WHERE id = ?').run(id);
    return result.changes > 0;
  }

  async getPlaybooksDependingOnCredential(credentialId: string): Promise<Playbook[]> {
    return (await this.getAllPlaybooks()).filter((playbook) =>
      playbook.dependsOnCredentialIds.includes(credentialId),
    );
  }

  async getPlaybooksDependingOnService(serviceId: string): Promise<Playbook[]> {
    return (await this.getAllPlaybooks()).filter((playbook) =>
      playbook.dependsOnServiceIds.includes(serviceId),
    );
  }

  async getDeckPlaybooksForDeck(deckId: string): Promise<Playbook[]> {
    const rows = this.db.prepare(`
      SELECT p.*, dp.position
      FROM deck_playbooks dp
      JOIN playbooks p ON p.id = dp.playbook_id
      WHERE dp.deck_id = ?
      ORDER BY dp.position ASC
    `).all(deckId) as any[];

    return rows.map((row) => this.mapPlaybookRow(row));
  }

  async addPlaybookToDeck(input: AddPlaybookToDeckInput): Promise<void> {
    const positionResult = this.db.prepare(`
      SELECT COALESCE(MAX(position), -1) + 1 as next_position
      FROM deck_playbooks WHERE deck_id = ?
    `).get(input.deckId) as any;

    const position = input.position ?? positionResult.next_position;

    this.db.prepare(`
      INSERT INTO deck_playbooks (deck_id, playbook_id, position)
      VALUES (@deck_id, @playbook_id, @position)
    `).run({
      deck_id: input.deckId,
      playbook_id: input.playbookId,
      position,
    });
  }

  async removePlaybookFromDeck(input: RemovePlaybookFromDeckInput): Promise<void> {
    this.db.prepare(`
      DELETE FROM deck_playbooks
      WHERE deck_id = @deck_id AND playbook_id = @playbook_id
    `).run({
      deck_id: input.deckId,
      playbook_id: input.playbookId,
    });
  }

  async getDeckPlaybooks(deckId: string): Promise<DeckPlaybook[]> {
    const rows = this.db.prepare(`
      SELECT deck_id, playbook_id, position FROM deck_playbooks
      WHERE deck_id = ?
      ORDER BY position ASC
    `).all(deckId) as any[];

    return rows.map((row) => ({
      deckId: row.deck_id,
      playbookId: row.playbook_id,
      position: row.position,
    }));
  }

  // Cleanup
  close(): void {
    this.db.close();
  }
}
