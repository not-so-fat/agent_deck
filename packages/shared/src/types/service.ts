export interface Service {
  id: string;
  name: string;
  type: 'mcp' | 'a2a';
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
  oauthState?: string;
}

export interface CreateServiceInput {
  name: string;
  type: 'mcp' | 'a2a';
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

export interface ServiceCallResult {
  success: boolean;
  result?: any;
  error?: string;
  serviceName?: string;
  toolName?: string;
}
