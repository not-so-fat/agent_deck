import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { MCPDatabaseManager } from './database.js';
import { MCPClientManager } from './mcp-client.js';

export class AgentDeckMCPServer {
  private server: Server;
  private dbManager: MCPDatabaseManager;
  private mcpClient: MCPClientManager;

  constructor() {
    this.dbManager = new MCPDatabaseManager();
    this.mcpClient = new MCPClientManager();

    this.server = new Server({
      name: 'agent-deck-mcp-server',
      version: '1.0.0',
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      }
    });

    this.setupToolHandlers();
    this.setupResourceHandlers();
    this.setupPromptHandlers();
  }

  private setupToolHandlers(): void {
    // List tools from active deck services
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        const activeDeck = await this.dbManager.getActiveDeck();
        if (!activeDeck) {
          return {
            tools: [],
          };
        }

        const allTools: any[] = [];
        
        for (const service of activeDeck.services) {
          try {
            if (service.type === 'mcp') {
              const tools = await this.mcpClient.discoverTools(service.url);
              allTools.push(...tools.map(tool => ({
                ...tool,
                name: `${service.name}:${tool.name}`,
                description: `[${service.name}] ${tool.description}`,
              })));
            }
          } catch (error) {
            console.error(`Failed to discover tools for service ${service.name}:`, error);
          }
        }

        return {
          tools: allTools,
        };
      } catch (error) {
        console.error('Error listing tools:', error);
        throw new Error('Failed to list tools');
      }
    });

    // Call tool from active deck services
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;
        
        // Parse service name and tool name from "service:tool" format
        const parts = name.split(':');
        if (parts.length !== 2) {
          throw new Error('Tool name must be in format "service:tool"');
        }

        const [serviceName, toolName] = parts;
        
        const activeDeck = await this.dbManager.getActiveDeck();
        if (!activeDeck) {
          throw new Error('No active deck found');
        }

        const service = activeDeck.services.find(s => s.name === serviceName);
        if (!service) {
          throw new Error(`Service "${serviceName}" not found in active deck`);
        }

        if (service.type !== 'mcp') {
          throw new Error(`Service "${serviceName}" is not an MCP service`);
        }

        const result = await this.mcpClient.callTool(service.url, toolName, args || {});
        
        return {
          content: result.content || [{ type: 'text', text: JSON.stringify(result) }],
        };
      } catch (error) {
        console.error('Error calling tool:', error);
        throw new Error(`Failed to call tool: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  private setupResourceHandlers(): void {
    // List resources from active deck services
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      try {
        const activeDeck = await this.dbManager.getActiveDeck();
        if (!activeDeck) {
          return {
            resources: [],
          };
        }

        const allResources: any[] = [];
        
        for (const service of activeDeck.services) {
          try {
            if (service.type === 'mcp') {
              const resources = await this.mcpClient.discoverResources(service.url);
              allResources.push(...resources.map(resource => ({
                ...resource,
                uri: `${service.name}:${resource.uri}`,
                name: `${service.name}:${resource.name}`,
              })));
            }
          } catch (error) {
            console.error(`Failed to discover resources for service ${service.name}:`, error);
          }
        }

        return {
          resources: allResources,
        };
      } catch (error) {
        console.error('Error listing resources:', error);
        throw new Error('Failed to list resources');
      }
    });

    // Read resource from active deck services
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        const { uri } = request.params;
        
        // Parse service name and resource URI from "service:uri" format
        const parts = uri.split(':');
        if (parts.length !== 2) {
          throw new Error('Resource URI must be in format "service:uri"');
        }

        const [serviceName, resourceUri] = parts;
        
        const activeDeck = await this.dbManager.getActiveDeck();
        if (!activeDeck) {
          throw new Error('No active deck found');
        }

        const service = activeDeck.services.find(s => s.name === serviceName);
        if (!service) {
          throw new Error(`Service "${serviceName}" not found in active deck`);
        }

        if (service.type !== 'mcp') {
          throw new Error(`Service "${serviceName}" is not an MCP service`);
        }

        const result = await this.mcpClient.getResource(service.url, resourceUri);
        
        return {
          contents: result.contents || [{ uri, mimeType: 'application/json', text: JSON.stringify(result) }],
        };
      } catch (error) {
        console.error('Error reading resource:', error);
        throw new Error(`Failed to read resource: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  private setupPromptHandlers(): void {
    // List prompts from active deck services
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      try {
        const activeDeck = await this.dbManager.getActiveDeck();
        if (!activeDeck) {
          return {
            prompts: [],
          };
        }

        const allPrompts: any[] = [];
        
        for (const service of activeDeck.services) {
          try {
            if (service.type === 'mcp') {
              const prompts = await this.mcpClient.listPrompts(service.url);
              allPrompts.push(...prompts.map(prompt => ({
                ...prompt,
                name: `${service.name}:${prompt.name}`,
              })));
            }
          } catch (error) {
            console.error(`Failed to list prompts for service ${service.name}:`, error);
          }
        }

        return {
          prompts: allPrompts,
        };
      } catch (error) {
        console.error('Error listing prompts:', error);
        throw new Error('Failed to list prompts');
      }
    });

    // Get prompt from active deck services
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      try {
        const { name } = request.params;
        
        // Parse service name and prompt name from "service:prompt" format
        const parts = name.split(':');
        if (parts.length !== 2) {
          throw new Error('Prompt name must be in format "service:prompt"');
        }

        const [serviceName, promptName] = parts;
        
        const activeDeck = await this.dbManager.getActiveDeck();
        if (!activeDeck) {
          throw new Error('No active deck found');
        }

        const service = activeDeck.services.find(s => s.name === serviceName);
        if (!service) {
          throw new Error(`Service "${serviceName}" not found in active deck`);
        }

        if (service.type !== 'mcp') {
          throw new Error(`Service "${serviceName}" is not an MCP service`);
        }

        const result = await this.mcpClient.getPrompt(service.url, promptName);
        
        return {
          prompt: result,
        };
      } catch (error) {
        console.error('Error getting prompt:', error);
        throw new Error(`Failed to get prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  async start(transport: StdioServerTransport | SSEServerTransport): Promise<void> {
    await this.server.connect(transport);
    console.log('Agent Deck MCP Server started');
  }

  async stop(): Promise<void> {
    this.dbManager.close();
    console.log('Agent Deck MCP Server stopped');
  }

  getServer(): Server {
    return this.server;
  }
}
