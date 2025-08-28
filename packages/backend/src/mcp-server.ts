import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

export class AgentDeckMCPServer {
  private port: number;
  private server: McpServer;
  private transport: StreamableHTTPServerTransport;
  private app: express.Application;
  private backendUrl: string;

  constructor(port: number = 3001, backendUrl: string = 'http://localhost:8000') {
    this.port = port;
    this.backendUrl = backendUrl;
    
    // Create Express app
    this.app = express();
    this.app.use(express.json());
    
    // Create MCP server with official SDK
    this.server = new McpServer({
      name: "agent-deck-server",
      version: "1.0.0"
    });
    
    // Create HTTP transport
    this.transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true
    });
    
    this.setupTools();
    this.setupResources();
    this.setupRoutes();
  }

  private async callBackendAPI(endpoint: string): Promise<any> {
    try {
      const response = await fetch(`${this.backendUrl}${endpoint}`);
      if (!response.ok) {
        throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
      }
      const body = await response.json();

      // Unwrap ApiResponse shape { success, data?, error? }
      if (typeof body === 'object' && body !== null && 'success' in body) {
        if (body.success) {
          // Some endpoints return the raw data (legacy); fallback to body if data missing
          return 'data' in body ? body.data : body;
        }
        const message = 'error' in body ? body.error : 'Unknown backend error';
        throw new Error(String(message));
      }

      // Fallback: return as-is if not wrapped
      return body;
    } catch (error) {
      console.error(`Failed to call backend API ${endpoint}:`, error);
      throw error;
    }
  }

  private setupTools() {
    // Get all services
    this.server.registerTool("get_services", {
      title: "Get Services",
      description: "Get all available MCP services from Agent Deck",
      inputSchema: {}
    }, async () => {
      try {
        const services = await this.callBackendAPI('/api/services');
        return {
          content: [{ type: "text", text: JSON.stringify(services, null, 2) }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }]
        };
      }
    });

    // Get all decks
    this.server.registerTool("get_decks", {
      title: "Get Decks",
      description: "Get all decks from Agent Deck",
      inputSchema: {}
    }, async () => {
      try {
        const decks = await this.callBackendAPI('/api/decks');
        return {
          content: [{ type: "text", text: JSON.stringify(decks, null, 2) }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }]
        };
      }
    });

    // Get active deck
    this.server.registerTool("get_active_deck", {
      title: "Get Active Deck",
      description: "Get the currently active deck",
      inputSchema: {}
    }, async () => {
      try {
        const activeDeck = await this.callBackendAPI('/api/decks/active');
        return {
          content: [{ type: "text", text: JSON.stringify(activeDeck, null, 2) }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }]
        };
      }
    });

    // List tools for a specific service
    this.server.registerTool("list_service_tools", {
      title: "List Service Tools",
      description: "List all available tools for a specific service",
      inputSchema: { serviceId: z.string() }
    }, async ({ serviceId }) => {
      try {
        const tools = await this.callBackendAPI(`/api/services/${serviceId}/tools`);
        return { content: [{ type: "text", text: JSON.stringify(tools, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }] };
      }
    });

    // List services in the active deck
    this.server.registerTool("list_active_deck_services", {
      title: "List Active Deck Services",
      description: "List all services in the currently active deck",
      inputSchema: {}
    }, async () => {
      try {
        const activeDeck = await this.callBackendAPI('/api/decks/active');
        const services = activeDeck?.services ?? [];
        return { content: [{ type: "text", text: JSON.stringify(services, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }] };
      }
    });

    // Call a tool on a registered service via backend API
    this.server.registerTool("call_service_tool", {
      title: "Call Service Tool",
      description: "Call a tool on a service from the active deck using the backend API",
      inputSchema: {
        serviceId: z.string(),
        toolName: z.string(),
        arguments: z.union([z.record(z.any()), z.string()]).optional()
      }
    }, async ({ serviceId, toolName, arguments: args = {} }) => {
      try {
        // Support both object and JSON string inputs for arguments
        let normalizedArgs: any = args;
        if (typeof normalizedArgs === 'string' && normalizedArgs.length > 0) {
          try {
            normalizedArgs = JSON.parse(normalizedArgs);
          } catch (e) {
            return { content: [{ type: "text", text: JSON.stringify({ error: `Invalid JSON in arguments: ${String(e)}` }, null, 2) }] };
          }
        }

        const res = await fetch(`${this.backendUrl}/api/services/${serviceId}/call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ toolName, arguments: normalizedArgs ?? {} })
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Backend API error ${res.status}: ${text}`);
        }
        const body: any = await res.json();
        const data = (body && (body as any).success) ? ((body as any).data ?? (body as any).result ?? body) : body;
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }] };
      }
    });
  }

  private setupResources() {
    // Register resource for services
    this.server.resource("services", "agent-deck://services", {
      name: "Agent Deck Services",
      description: "List of all available MCP services",
      mimeType: "application/json"
    }, async () => {
      try {
        const services = await this.callBackendAPI('/api/services');
        
        return {
          contents: [{
            uri: "agent-deck://services",
            mimeType: "application/json",
            text: JSON.stringify(services, null, 2)
          }]
        };
      } catch (error) {
        return {
          contents: [{
            uri: "agent-deck://services",
            mimeType: "application/json",
            text: JSON.stringify({ error: `Failed to get services: ${error}` }, null, 2)
          }]
        };
      }
    });

    // Register resource for decks
    this.server.resource("decks", "agent-deck://decks", {
      name: "Agent Deck Decks",
      description: "List of all decks",
      mimeType: "application/json"
    }, async () => {
      try {
        const decks = await this.callBackendAPI('/api/decks');
        
        return {
          contents: [{
            uri: "agent-deck://decks",
            mimeType: "application/json",
            text: JSON.stringify(decks, null, 2)
          }]
        };
      } catch (error) {
        return {
          contents: [{
            uri: "agent-deck://decks",
            mimeType: "application/json",
            text: JSON.stringify({ error: `Failed to get decks: ${error}` }, null, 2)
          }]
        };
      }
    });
  }

  private setupRoutes() {
    // Handle MCP requests
    this.app.post('/mcp', async (req: Request, res: Response) => {
      await this.transport.handleRequest(req, res, req.body);
    });

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ 
        status: 'ok', 
        service: 'agent-deck-mcp-server',
        backendUrl: this.backendUrl
      });
    });

    // Backend connectivity check
    this.app.get('/backend-status', async (req: Request, res: Response) => {
      try {
        const response = await fetch(`${this.backendUrl}/health`);
        const backendStatus = await response.json();
        res.json({
          mcpServer: 'ok',
          backend: backendStatus,
          connected: response.ok
        });
              } catch (error) {
          res.json({
            mcpServer: 'ok',
            backend: 'unreachable',
            connected: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
    });
  }

  async start() {
    try {
      console.log(`🚀 Starting Agent Deck MCP Server on port ${this.port}...`);
      console.log(`🔗 Backend API URL: ${this.backendUrl}`);
      
      // Connect the server to the transport (this will start the transport)
      await this.server.connect(this.transport);
      
      // Start the Express server
      this.app.listen(this.port, () => {
        console.log(`✅ Agent Deck MCP Server is ready to accept connections`);
        console.log(`📋 Available tools:`);
        console.log(`   - get_services: Get all available MCP services`);
        console.log(`   - get_decks: Get all decks`);
        console.log(`   - get_active_deck: Get the currently active deck`);
        console.log(`📋 Available resources:`);
        console.log(`   - agent-deck://services: List of all services`);
        console.log(`   - agent-deck://decks: List of all decks`);
        console.log(`🌐 Server running on http://localhost:${this.port}`);
        console.log(`🔧 MCP endpoint: http://localhost:${this.port}/mcp`);
        console.log(`❤️  Health check: http://localhost:${this.port}/health`);
        console.log(`🔗 Backend status: http://localhost:${this.port}/backend-status`);
        console.log(`📝 Architecture: MCP Server → Backend API → Database`);
      });
      
      return this.app;
    } catch (error) {
      console.error(`❌ Failed to start MCP server:`, error);
      throw error;
    }
  }

  async stop() {
    try {
      await this.transport.close();
      console.log(`🛑 MCP server stopped`);
    } catch (error) {
      console.error(`❌ Error stopping MCP server:`, error);
    }
  }
}