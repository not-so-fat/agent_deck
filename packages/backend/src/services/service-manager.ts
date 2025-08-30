import { 
  Service, 
  CreateServiceInput, 
  UpdateServiceInput,
  ServiceTool,
  ServiceCallInput,
  ServiceCallResult,
  CreateServiceSchema,
  UpdateServiceSchema,
  ServiceCallSchema
} from '@agent-deck/shared';
import { DatabaseManager } from '../models/database';
import { MCPClientManager } from './mcp-client-manager';
import { OAuthManager } from './oauth-manager';
import { ConfigManager } from './config-manager';

interface A2AManifest {
  endpoints?: Record<string, A2AEndpoint>;
}

interface A2AEndpoint {
  path: string;
  method?: string;
  description?: string;
  inputSchema?: Record<string, any>;
}

export class ServiceManager {
  private configManager: ConfigManager;

  constructor(
    private db: DatabaseManager,
    private mcpClient: MCPClientManager,
    private oauthManager: OAuthManager
  ) {
    this.configManager = new ConfigManager();
  }

  get mcpClientManager(): MCPClientManager {
    return this.mcpClient;
  }

  async createService(input: CreateServiceInput): Promise<Service> {
    // Validate input
    const validatedInput = CreateServiceSchema.parse(input);
    
    // Create service in database
    const service = await this.db.createService(validatedInput);
    
    // Try to discover OAuth configuration if it's an MCP service
    if (service.type === 'mcp' && !service.oauthClientId) {
      try {
        const oauthDiscovery = await this.oauthManager.discoverOAuth(service.url);
        if (oauthDiscovery.hasOAuth && oauthDiscovery.config) {
          await this.db.updateService(service.id, {
            oauthClientId: oauthDiscovery.config.clientId,
            oauthClientSecret: oauthDiscovery.config.clientSecret,
            oauthAuthorizationUrl: oauthDiscovery.config.authorizationUrl,
            oauthTokenUrl: oauthDiscovery.config.tokenUrl,
            oauthRedirectUri: oauthDiscovery.config.redirectUri,
            oauthScope: oauthDiscovery.config.scope,
          });
        }
      } catch (error) {
        console.warn(`Failed to discover OAuth for service ${service.id}:`, error);
      }
    }
    
    return service;
  }

  async getService(id: string): Promise<Service | null> {
    return await this.db.getService(id);
  }

  async getAllServices(): Promise<Service[]> {
    return await this.db.getAllServices();
  }

  async updateService(id: string, input: UpdateServiceInput): Promise<Service | null> {
    // Validate input
    const validatedInput = UpdateServiceSchema.parse(input);
    
    return await this.db.updateService(id, validatedInput);
  }

  async deleteService(id: string): Promise<boolean> {
    return await this.db.deleteService(id);
  }

  async discoverServiceTools(serviceId: string): Promise<ServiceTool[] | { success: false; error: string }> {
    const service = await this.db.getService(serviceId);
    if (!service) {
      return { success: false, error: 'Service not found' };
    }

    try {
      if (service.type === 'mcp' || service.type === 'local-mcp') {
        const tools = await this.mcpClient.discoverTools(service);
        return tools;
      } else if (service.type === 'a2a') {
        return await this.discoverA2ATools(service);
      } else {
        return { success: false, error: `Unsupported service type: ${service.type}` };
      }
    } catch (error) {
      console.error(`Failed to discover tools for service ${serviceId}:`, error);
      return { success: false, error: 'Failed to discover tools' };
    }
  }

  async callServiceTool(input: ServiceCallInput): Promise<ServiceCallResult> {
    // Validate input
    const validatedInput = ServiceCallSchema.parse(input);
    
    const service = await this.db.getService(validatedInput.serviceId);
    if (!service) {
      return {
        success: false,
        error: 'Service not found',
      };
    }

    try {
      if (service.type === 'mcp' || service.type === 'local-mcp') {
        const result = await this.mcpClient.callTool(
          service,
          validatedInput.toolName,
          validatedInput.arguments
        );
        return {
          success: true,
          result: result,
        };
      } else if (service.type === 'a2a') {
        const result = await this.callA2ATool(service, validatedInput.toolName, validatedInput.arguments || {});
        return {
          success: true,
          result: result,
        };
      } else {
        return {
          success: false,
          error: `Unsupported service type: ${service.type}`,
        };
      }
    } catch (error) {
      console.error(`Failed to call tool for service ${validatedInput.serviceId}:`, error);
      return {
        success: false,
        error: 'Failed to call tool',
      };
    }
  }

  async checkServiceHealth(serviceId: string): Promise<{ success: boolean; health: string; isConnected: boolean } | { success: false; error: string }> {
    const service = await this.db.getService(serviceId);
    if (!service) {
      return { success: false, error: 'Service not found' };
    }

    try {
      if (service.type === 'mcp' || service.type === 'local-mcp') {
        await this.mcpClient.discoverTools(service);
        await this.db.updateServiceStatus(serviceId, true, 'healthy');
        return {
          success: true,
          health: 'healthy',
          isConnected: true,
        };
      } else if (service.type === 'a2a') {
        await this.discoverA2ATools(service);
        await this.db.updateServiceStatus(serviceId, true, 'healthy');
        return {
          success: true,
          health: 'healthy',
          isConnected: true,
        };
      } else {
        return { success: false, error: `Unsupported service type: ${service.type}` };
      }
    } catch (error) {
      console.error(`Health check failed for service ${serviceId}:`, error);
      await this.db.updateServiceStatus(serviceId, false, 'unhealthy');
      return {
        success: true,
        health: 'unhealthy',
        isConnected: false,
      };
    }
  }

  private async discoverA2ATools(service: Service): Promise<ServiceTool[]> {
    try {
      const response = await fetch(`${service.url}/manifest`);
      if (!response.ok) {
        throw new Error(`Failed to fetch A2A manifest: ${response.statusText}`);
      }

      const manifest: A2AManifest = await response.json() as A2AManifest;
      const tools: ServiceTool[] = [];

      if (manifest.endpoints) {
        for (const [name, endpoint] of Object.entries(manifest.endpoints)) {
          tools.push({
            name,
            description: endpoint.description || `A2A endpoint: ${name}`,
            inputSchema: endpoint.inputSchema || {},
          });
        }
      }

      return tools;
    } catch (error) {
      console.error(`Failed to discover A2A tools for service ${service.id}:`, error);
      throw error;
    }
  }

  private async callA2ATool(service: Service, toolName: string, arguments_: Record<string, any>): Promise<any> {
    try {
      const response = await fetch(`${service.url}/${toolName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...service.headers,
        },
        body: JSON.stringify(arguments_),
      });

      if (!response.ok) {
        throw new Error(`A2A tool call failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to call A2A tool ${toolName} for service ${service.id}:`, error);
      throw error;
    }
  }

  /**
   * Import local MCP servers from JSON configuration
   */
  async importLocalServersFromConfig(jsonContent: string): Promise<Service[]> {
    try {
      const manifest = this.configManager.parseManifest(jsonContent);
      const services = this.configManager.manifestToServices(manifest);
      
      const createdServices: Service[] = [];
      
      for (const serviceInput of services) {
        // Check if service already exists
        const existingServices = await this.db.getAllServices();
        const existingService = existingServices.find(s => 
          s.type === 'local-mcp' && s.name === serviceInput.name
        );
        
        if (existingService) {
          console.log(`⚠️ Local MCP server ${serviceInput.name} already exists, skipping`);
          continue;
        }
        
        // Validate command safety
        if (!this.configManager.isCommandSafe(serviceInput.localCommand!)) {
          console.warn(`⚠️ Skipping potentially unsafe command: ${serviceInput.localCommand}`);
          continue;
        }
        
        // Sanitize environment variables
        if (serviceInput.localEnv) {
          serviceInput.localEnv = this.configManager.sanitizeEnvironment(serviceInput.localEnv);
        }
        
        const service = await this.createService(serviceInput);
        createdServices.push(service);
        console.log(`✅ Created local MCP server: ${service.name}`);
      }
      
      return createdServices;
    } catch (error) {
      console.error('❌ Failed to import local servers from config:', error);
      throw error;
    }
  }

  /**
   * Get sample configuration
   */
  getSampleConfig(): string {
    const sampleManifest = this.configManager.generateSampleManifest();
    return this.configManager.manifestToJson(sampleManifest);
  }

  /**
   * Start a local MCP server
   */
  async startLocalServer(serviceId: string): Promise<void> {
    const service = await this.db.getService(serviceId);
    if (!service) {
      throw new Error('Service not found');
    }
    
    if (service.type !== 'local-mcp') {
      throw new Error('Service is not a local MCP server');
    }
    
    // The MCP client manager will handle starting the server when needed
    await this.mcpClient.discoverTools(service);
  }

  /**
   * Stop a local MCP server
   */
  async stopLocalServer(serviceId: string): Promise<void> {
    const service = await this.db.getService(serviceId);
    if (!service) {
      throw new Error('Service not found');
    }
    
    if (service.type !== 'local-mcp') {
      throw new Error('Service is not a local MCP server');
    }
    
    // Get the local server manager from the MCP client manager
    const localManager = (this.mcpClient as any).localServerManager;
    if (localManager) {
      await localManager.stopLocalServer(serviceId);
    }
  }

  /**
   * Get local MCP server status
   */
  async getLocalServerStatus(serviceId: string): Promise<any> {
    const service = await this.db.getService(serviceId);
    if (!service) {
      throw new Error('Service not found');
    }
    
    if (service.type !== 'local-mcp') {
      throw new Error('Service is not a local MCP server');
    }
    
    // Get the local server manager from the MCP client manager
    const localManager = (this.mcpClient as any).localServerManager;
    if (localManager) {
      const processRecord = localManager.getLocalServer(serviceId);
      if (processRecord) {
        return {
          isRunning: processRecord.isRunning,
          startTime: processRecord.startTime,
          lastActivity: processRecord.lastActivity,
          capabilities: processRecord.capabilities
        };
      }
    }
    
    return {
      isRunning: false,
      startTime: null,
      lastActivity: null,
      capabilities: null
    };
  }
}
