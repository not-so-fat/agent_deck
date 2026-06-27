import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { Request, Response, type Application } from 'express';
import { randomUUID } from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

const MCP_APP_RESOURCE_URI = "ui://agent-deck/mcp-app.html";

const MCP_APP_CSP = {
  connectDomains: [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "ws://localhost:8000",
    "ws://127.0.0.1:8000",
  ],
  resourceDomains: [
    "https://fonts.googleapis.com",
    "https://fonts.gstatic.com",
  ],
};

type McpSession = {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
};

export class AgentDeckMCPServer {
  private port: number;
  private sessions = new Map<string, McpSession>();
  private app: Application;
  private backendUrl: string;
  private dashboardUrl: string;
  private mcpAppHtmlCache: string | null = null;
  private mcpAppHtmlCacheMtimeMs: number | null = null;

  constructor(
    port: number = 3001,
    backendUrl: string = 'http://localhost:8000',
    dashboardUrl: string = process.env.AGENT_DECK_DASHBOARD_URL ?? 'http://localhost:3000'
  ) {
    this.port = port;
    this.backendUrl = backendUrl;
    this.dashboardUrl = dashboardUrl;

    this.app = createMcpExpressApp({ host: '127.0.0.1' });
    this.setupCors();
    this.setupRoutes();
  }

  private setupCors() {
    // Cursor's MCP client runs in Chromium and sends CORS preflight (OPTIONS).
    this.app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Accept, mcp-session-id, Mcp-Session-Id, mcp-protocol-version, Mcp-Protocol-Version, Authorization'
      );
      res.setHeader('Access-Control-Max-Age', '86400');

      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }

      next();
    });
  }

  private async createMcpServer(): Promise<McpServer> {
    const server = new McpServer({
      name: "agent-deck-server",
      version: "1.0.0",
    });
    this.registerTools(server);
    this.registerResources(server);
    await this.registerMcpApp(server);
    return server;
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

  private async postBackendAPI(endpoint: string): Promise<any> {
    try {
      const response = await fetch(`${this.backendUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      });
      const body = await response.json();

      if (!response.ok) {
        const message = typeof body === 'object' && body !== null && 'error' in body
          ? String(body.error)
          : `${response.status} ${response.statusText}`;
        throw new Error(message);
      }

      if (typeof body === 'object' && body !== null && 'success' in body) {
        if (body.success) {
          return 'data' in body ? body.data : body;
        }
        const message = 'error' in body ? body.error : 'Unknown backend error';
        throw new Error(String(message));
      }

      return body;
    } catch (error) {
      console.error(`Failed to call backend API ${endpoint}:`, error);
      throw error;
    }
  }

  private async getDeckOverview() {
    const decks = await this.callBackendAPI('/api/decks');
    let activeDeck = null;

    try {
      activeDeck = await this.callBackendAPI('/api/decks/active');
    } catch {
      activeDeck = null;
    }

    return {
      activeDeck,
      decks,
      dashboardUrl: this.dashboardUrl,
    };
  }

  private getMcpAppHtmlPath() {
    const candidates = [
      path.resolve(__dirname, '../../mcp-app/dist/mcp-app.html'),
      path.resolve(process.cwd(), 'packages/mcp-app/dist/mcp-app.html'),
      path.resolve(process.cwd(), '../mcp-app/dist/mcp-app.html'),
    ];
    for (const candidate of candidates) {
      if (fsSync.existsSync(candidate)) {
        return candidate;
      }
    }
    throw new Error(
      `MCP App bundle not found. Build it with: npm run build --workspace @agent-deck/mcp-app\n` +
      `Tried: ${candidates.join(', ')}`
    );
  }

  private async getMcpAppHtml() {
    const htmlPath = this.getMcpAppHtmlPath();
    const { mtimeMs } = await fs.stat(htmlPath);

    if (this.mcpAppHtmlCache && this.mcpAppHtmlCacheMtimeMs === mtimeMs) {
      return this.mcpAppHtmlCache;
    }

    this.mcpAppHtmlCache = await fs.readFile(htmlPath, "utf-8");
    this.mcpAppHtmlCacheMtimeMs = mtimeMs;
    return this.mcpAppHtmlCache;
  }

  private registerTools(server: McpServer) {
    // Get all decks (useful for seeing available decks)
    server.registerTool("get_decks", {
      title: "Get Decks",
      description: "Get all available decks from Agent Deck",
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

    // Get active deck with its services
    server.registerTool("get_active_deck", {
      title: "Get Active Deck",
      description: "Get the currently active deck with all its services",
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

    // List services in the active deck
    server.registerTool("list_active_deck_services", {
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

    // List tools for a specific service in the active deck
    server.registerTool("list_service_tools", {
      title: "List Service Tools",
      description: "List all available tools for a specific service in the active deck",
      inputSchema: { serviceId: z.string() }
    }, async ({ serviceId }) => {
      try {
        const tools = await this.callBackendAPI(`/api/services/${serviceId}/tools`);
        return { content: [{ type: "text", text: JSON.stringify(tools, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }] };
      }
    });

    // Call a tool on a service in the active deck
    server.registerTool("call_service_tool", {
      title: "Call Service Tool",
      description: "Call a tool on a service from the active deck",
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

  private async registerMcpApp(server: McpServer) {
    const {
      registerAppResource,
      registerAppTool,
      RESOURCE_MIME_TYPE,
    } = await import("@modelcontextprotocol/ext-apps/server");

      registerAppTool(
        server,
        "show_agent_deck",
        {
          title: "Show Agent Deck",
          description:
            "Open the Agent Deck control panel with the active deck, connected services, and deck switching controls.",
          _meta: { ui: { resourceUri: MCP_APP_RESOURCE_URI } },
        },
        async () => {
          try {
            const overview = await this.getDeckOverview();
            return {
              content: [{ type: "text", text: JSON.stringify(overview) }],
            };
          } catch (error) {
            return {
              content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }],
            };
          }
        }
      );

      server.registerTool(
        "activate_deck",
        {
          title: "Activate Deck",
          description: "Set the active Agent Deck context used by proxied MCP tools.",
          inputSchema: { deckId: z.string() },
        },
        async ({ deckId }: { deckId: string }) => {
          try {
            await this.postBackendAPI(`/api/decks/${deckId}/activate`);
            const overview = await this.getDeckOverview();
            return {
              content: [{ type: "text", text: JSON.stringify(overview) }],
            };
          } catch (error) {
            return {
              content: [{ type: "text", text: JSON.stringify({ error: String(error) }, null, 2) }],
            };
          }
        }
      );

      registerAppResource(
        server as unknown as Parameters<typeof registerAppResource>[0],
        "Agent Deck App",
        MCP_APP_RESOURCE_URI,
        { mimeType: RESOURCE_MIME_TYPE },
        async () => {
          const html = await this.getMcpAppHtml();
          return {
            contents: [
              {
                uri: MCP_APP_RESOURCE_URI,
                mimeType: RESOURCE_MIME_TYPE,
                text: html,
                _meta: {
                  ui: {
                    csp: MCP_APP_CSP,
                  },
                },
              },
            ],
          };
        }
      );
  }

  private registerResources(server: McpServer) {
    // Register resource for active deck services only
    server.resource("active_deck_services", "agent-deck://active-deck/services", {
      description: "List of services in the currently active deck",
      mimeType: "application/json"
    }, async () => {
      try {
        const activeDeck = await this.callBackendAPI('/api/decks/active');
        const services = activeDeck?.services ?? [];
        
        return {
          contents: [{
            uri: "agent-deck://active-deck/services",
            mimeType: "application/json",
            text: JSON.stringify(services, null, 2)
          }]
        };
      } catch (error) {
        return {
          contents: [{
            uri: "agent-deck://active-deck/services",
            mimeType: "application/json",
            text: JSON.stringify({ error: `Failed to get active deck services: ${error}` }, null, 2)
          }]
        };
      }
    });

    // Register resource for active deck
    server.resource("active_deck", "agent-deck://active-deck", {
      description: "The currently active deck with all its services",
      mimeType: "application/json"
    }, async () => {
      try {
        const activeDeck = await this.callBackendAPI('/api/decks/active');
        
        return {
          contents: [{
            uri: "agent-deck://active-deck",
            mimeType: "application/json",
            text: JSON.stringify(activeDeck, null, 2)
          }]
        };
      } catch (error) {
        return {
          contents: [{
            uri: "agent-deck://active-deck",
            mimeType: "application/json",
            text: JSON.stringify({ error: `Failed to get active deck: ${error}` }, null, 2)
          }]
        };
      }
    });

    // Register resource for all decks
    server.resource("decks", "agent-deck://decks", {
      description: "List of all available decks",
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
    // Each MCP client gets its own server+transport pair (required for multi-client support).
    this.app.all('/mcp', async (req: Request, res: Response) => {
      try {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let transport: StreamableHTTPServerTransport | undefined;

        if (sessionId && this.sessions.has(sessionId)) {
          transport = this.sessions.get(sessionId)!.transport;
        } else if (sessionId) {
          // Stale session (e.g. server restarted) — tell client to re-initialize.
          res.status(404).json({
            jsonrpc: '2.0',
            error: { code: -32001, message: 'Session not found' },
            id: null,
          });
          return;
        } else if (req.method === 'POST' && isInitializeRequest(req.body)) {
          let sessionEntry: McpSession;
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            enableJsonResponse: true,
            onsessioninitialized: (id) => {
              this.sessions.set(id, sessionEntry);
            },
            onsessionclosed: (id) => {
              if (id) {
                this.sessions.delete(id);
              }
            },
          });

          transport.onclose = () => {
            const id = transport?.sessionId;
            if (id) {
              this.sessions.delete(id);
            }
          };

          const server = await this.createMcpServer();
          sessionEntry = { transport, server };
          await server.connect(transport);
        } else {
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: No valid session ID provided',
            },
            id: null,
          });
          return;
        }

        await transport.handleRequest(req, res, req.method === 'POST' ? req.body : undefined);
      } catch (error) {
        console.error('Error handling MCP request:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
            },
            id: null,
          });
        }
      }
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

      await this.getMcpAppHtml();

      // Start the Express server (bind loopback only — matches Cursor MCP config)
      await new Promise<void>((resolve, reject) => {
        const server = this.app.listen(this.port, '127.0.0.1', () => {
          console.log(`✅ Agent Deck MCP Server is ready to accept connections`);
          console.log(`📋 Available tools:`);
          console.log(`   - show_agent_deck: Open the Agent Deck MCP App UI`);
          console.log(`   - activate_deck: Switch the active deck from the MCP App`);
          console.log(`   - get_decks: Get all available decks`);
          console.log(`   - get_active_deck: Get the currently active deck with services`);
          console.log(`   - list_active_deck_services: List services in the active deck`);
          console.log(`   - list_service_tools: List tools for a specific service`);
          console.log(`   - call_service_tool: Call a tool on a service`);
          console.log(`🧩 MCP App resource: ${MCP_APP_RESOURCE_URI}`);
          console.log(`🖥️  Dashboard URL: ${this.dashboardUrl}`);
          console.log(`📋 Available resources:`);
          console.log(`   - agent-deck://decks: List of all available decks`);
          console.log(`   - agent-deck://active-deck: The currently active deck`);
          console.log(`   - agent-deck://active-deck/services: Services in the active deck`);
          console.log(`🌐 Server running on http://127.0.0.1:${this.port}`);
          console.log(`🔧 MCP endpoint: http://localhost:${this.port}/mcp`);
          console.log(`❤️  Health check: http://localhost:${this.port}/health`);
          console.log(`🔗 Backend status: http://localhost:${this.port}/backend-status`);
          console.log(`📝 Architecture: MCP Server → Backend API → Active Deck Services`);
          resolve();
        });

        server.on('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE') {
            reject(new Error(
              `Port ${this.port} is already in use. Stop other dev-all/MCP processes first (lsof -i :${this.port}).`
            ));
            return;
          }
          reject(error);
        });
      });

      return this.app;
    } catch (error) {
      console.error(`❌ Failed to start MCP server:`, error);
      throw error;
    }
  }

  async stop() {
    try {
      for (const { transport } of this.sessions.values()) {
        await transport.close();
      }
      this.sessions.clear();
      console.log(`🛑 MCP server stopped`);
    } catch (error) {
      console.error(`❌ Error stopping MCP server:`, error);
    }
  }
}