export interface Service {
  id: string;
  name: string;
  type: 'mcp' | 'a2a' | 'local-mcp';
  url: string;
  health: 'unknown' | 'healthy' | 'unhealthy';
  description?: string;
  cardColor: string;
  isConnected: boolean;
  lastPing?: string;
  registeredAt: string;
  updatedAt: string;
  headers?: Record<string, string>;
  
  // OAuth fields
  oauthClientId?: string;
  oauthClientSecret?: string;
  oauthAuthorizationUrl?: string;
  oauthTokenUrl?: string;
  oauthRedirectUri?: string;
  oauthScope?: string;
  oauthAccessToken?: string;
  oauthRefreshToken?: string;
  oauthTokenExpiresAt?: string;
  /** True when access token is stored in Keychain (not returned to clients). */
  oauthHasToken?: boolean;
  oauthState?: string;
  
  // Local MCP server fields
  localCommand?: string;
  localArgs?: string[];
  localWorkingDir?: string;
  localEnv?: Record<string, string>;
}

export interface CreateServiceInput {
  name: string;
  type: 'mcp' | 'a2a' | 'local-mcp';
  url: string;
  description?: string;
  cardColor?: string;
  headers?: Record<string, string>;
  
  // OAuth fields
  oauthClientId?: string;
  oauthClientSecret?: string;
  oauthAuthorizationUrl?: string;
  oauthTokenUrl?: string;
  oauthRedirectUri?: string;
  oauthScope?: string;
  
  // Local MCP server fields
  localCommand?: string;
  localArgs?: string[];
  localWorkingDir?: string;
  localEnv?: Record<string, string>;
}

export interface UpdateServiceInput {
  name?: string;
  description?: string;
  cardColor?: string;
  headers?: Record<string, string>;
  
  // OAuth fields
  oauthClientId?: string;
  oauthClientSecret?: string;
  oauthAuthorizationUrl?: string;
  oauthTokenUrl?: string;
  oauthRedirectUri?: string;
  oauthScope?: string;
  
  // Local MCP server fields
  localCommand?: string;
  localArgs?: string[];
  localWorkingDir?: string;
  localEnv?: Record<string, string>;
}

export interface ServiceTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export interface ServiceCallInput {
  serviceId: string;
  toolName: string;
  arguments: Record<string, any>;
}

export type McpErrorCode =
  | 'MCP_TRANSPORT_ERROR'
  | 'MCP_AUTH_ERROR'
  | 'MCP_TOOL_ERROR'
  | 'MCP_CONNECTION_ERROR';

export interface ServiceToolErrorDetails {
  service_id: string;
  service_name: string;
  remote_url: string;
  tool_name?: string;
  cause: string;
  phase: 'connect' | 'discoverTools' | 'callTool';
}

export interface ServiceCallResult {
  success: boolean;
  result?: any;
  error?: string;
  error_code?: McpErrorCode;
  details?: ServiceToolErrorDetails;
  serviceName?: string;
  toolName?: string;
}

// Local MCP server types are now defined in schemas/service.ts
