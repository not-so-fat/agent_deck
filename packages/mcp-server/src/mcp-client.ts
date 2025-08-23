import { ServiceTool } from '@agent-deck/shared';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export interface MCPResponse {
  content: Array<{
    type: string;
    text?: string;
    [key: string]: any;
  }>;
}

export class MCPClientManager {
  async discoverTools(serviceUrl: string): Promise<MCPTool[]> {
    try {
      const response = await fetch(`${serviceUrl}/tools`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to discover tools: ${response.statusText}`);
      }

      const data = await response.json() as { tools: MCPTool[] };
      return data.tools || [];
    } catch (error) {
      console.error(`Error discovering tools for ${serviceUrl}:`, error);
      throw error;
    }
  }

  async callTool(serviceUrl: string, toolName: string, arguments_: Record<string, any>): Promise<any> {
    try {
      const response = await fetch(`${serviceUrl}/tools/${toolName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          arguments: arguments_,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to call tool: ${response.statusText}`);
      }

      const data = await response.json() as MCPResponse;
      return data;
    } catch (error) {
      console.error(`Error calling tool ${toolName} on ${serviceUrl}:`, error);
      throw error;
    }
  }

  async discoverResources(serviceUrl: string): Promise<any[]> {
    try {
      const response = await fetch(`${serviceUrl}/resources`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to discover resources: ${response.statusText}`);
      }

      const data = await response.json() as { resources: any[] };
      return data.resources || [];
    } catch (error) {
      console.error(`Error discovering resources for ${serviceUrl}:`, error);
      throw error;
    }
  }

  async getResource(serviceUrl: string, resourceName: string): Promise<any> {
    try {
      const response = await fetch(`${serviceUrl}/resources/${resourceName}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get resource: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error getting resource ${resourceName} from ${serviceUrl}:`, error);
      throw error;
    }
  }

  async listPrompts(serviceUrl: string): Promise<any[]> {
    try {
      const response = await fetch(`${serviceUrl}/prompts`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list prompts: ${response.statusText}`);
      }

      const data = await response.json() as { prompts: any[] };
      return data.prompts || [];
    } catch (error) {
      console.error(`Error listing prompts for ${serviceUrl}:`, error);
      throw error;
    }
  }

  async getPrompt(serviceUrl: string, promptName: string): Promise<any> {
    try {
      const response = await fetch(`${serviceUrl}/prompts/${promptName}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get prompt: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error getting prompt ${promptName} from ${serviceUrl}:`, error);
      throw error;
    }
  }
}
