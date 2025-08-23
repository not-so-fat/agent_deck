import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentDeckMCPServer } from './server.js';
import { MCPDatabaseManager } from './database.js';
import { MCPClientManager } from './mcp-client.js';

// Mock the dependencies
vi.mock('./database.js');
vi.mock('./mcp-client.js');

describe('AgentDeckMCPServer', () => {
  let server: AgentDeckMCPServer;
  let mockDbManager: any;
  let mockMCPClient: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock instances
    mockDbManager = {
      getActiveDeck: vi.fn(),
      close: vi.fn(),
    };

    mockMCPClient = {
      discoverTools: vi.fn(),
      callTool: vi.fn(),
      discoverResources: vi.fn(),
      getResource: vi.fn(),
      listPrompts: vi.fn(),
      getPrompt: vi.fn(),
    };

    // Mock the constructors
    vi.mocked(MCPDatabaseManager).mockImplementation(() => mockDbManager);
    vi.mocked(MCPClientManager).mockImplementation(() => mockMCPClient);

    server = new AgentDeckMCPServer();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should create server with correct name and version', () => {
      expect(server).toBeInstanceOf(AgentDeckMCPServer);
    });
  });

  describe('Database Integration', () => {
    it('should use MCPDatabaseManager', () => {
      expect(MCPDatabaseManager).toHaveBeenCalled();
    });

    it('should use MCPClientManager', () => {
      expect(MCPClientManager).toHaveBeenCalled();
    });
  });

  describe('Stop Method', () => {
    it('should close database connection', async () => {
      await server.stop();
      expect(mockDbManager.close).toHaveBeenCalled();
    });
  });
});
