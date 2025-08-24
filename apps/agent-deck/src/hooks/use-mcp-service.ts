import React from 'react';
import { useMcp } from 'use-mcp/react';
import { Service } from '@agent-deck/shared';
import { useToast } from './use-toast';

interface UseMcpServiceOptions {
  service: Service;
  autoConnect?: boolean;
  onConnected?: () => void;
  onError?: (error: string) => void;
}

interface UseMcpServiceResult {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  isAuthenticating: boolean;
  hasError: boolean;
  error: string | null;
  
  // MCP capabilities
  tools: any[];
  resources: any[];
  prompts: any[];
  
  // Actions
  connect: () => void;
  disconnect: () => void;
  retry: () => void;
  authenticate: () => void;
  
  // Tool calling
  callTool: (name: string, args?: Record<string, unknown>) => Promise<any>;
  
  // Resource access
  readResource: (uri: string) => Promise<{ contents: Array<any> }>;
  listResources: () => Promise<void>;
  
  // Prompt access
  getPrompt: (name: string, args?: Record<string, string>) => Promise<{ messages: Array<any> }>;
  listPrompts: () => Promise<void>;
  
  // OAuth
  authUrl: string | undefined;
  clearStorage: () => void;
}

export function useMcpService({
  service,
  autoConnect = false,
  onConnected,
  onError
}: UseMcpServiceOptions): UseMcpServiceResult {
  const { toast } = useToast();
  
  const {
    state,
    tools,
    resources,
    prompts,
    error,
    authUrl,
    callTool: mcpCallTool,
    readResource: mcpReadResource,
    listResources: mcpListResources,
    getPrompt: mcpGetPrompt,
    listPrompts: mcpListPrompts,
    retry,
    disconnect,
    authenticate,
    clearStorage,
  } = useMcp({
    url: service.url,
    clientName: 'AgentDeck',
    clientUri: window.location.origin,
    callbackUrl: `${window.location.origin}/oauth/callback`,
    storageKeyPrefix: `mcp:auth:${service.id}`,
    debug: true,
    autoRetry: 3,
    autoReconnect: 5000,
    transportType: 'auto',
    preventAutoAuth: !autoConnect,
  });

  // Map use-mcp states to our interface
  const isConnected = state === 'ready';
  const isConnecting = state === 'connecting' || state === 'loading';
  const isAuthenticating = state === 'authenticating' || state === 'pending_auth';
  const hasError = state === 'failed';
  
  // Handle state changes
  React.useEffect(() => {
    if (isConnected && onConnected) {
      onConnected();
      toast({
        title: "Connected to MCP service",
        description: `Successfully connected to ${service.name}`,
      });
    }
  }, [isConnected, onConnected, service.name, toast]);
  
  React.useEffect(() => {
    if (hasError && error && onError) {
      onError(error);
      toast({
        title: "MCP connection failed",
        description: error,
        variant: "destructive",
      });
    }
  }, [hasError, error, onError, toast]);

  // Wrapper functions with error handling
  const callTool = async (name: string, args?: Record<string, unknown>) => {
    try {
      return await mcpCallTool(name, args);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Tool call failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  };

  const readResource = async (uri: string) => {
    try {
      return await mcpReadResource(uri);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Resource read failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  };

  const listResources = async () => {
    try {
      await mcpListResources();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Resource listing failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  };

  const getPrompt = async (name: string, args?: Record<string, string>) => {
    try {
      return await mcpGetPrompt(name, args);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Prompt retrieval failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  };

  const listPrompts = async () => {
    try {
      await mcpListPrompts();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Prompt listing failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    // Connection state
    isConnected,
    isConnecting,
    isAuthenticating,
    hasError,
    error,
    
    // MCP capabilities
    tools,
    resources,
    prompts,
    
    // Actions
    connect: () => {
      // Trigger connection by calling retry
      retry();
    },
    disconnect,
    retry,
    authenticate,
    
    // Tool calling
    callTool,
    
    // Resource access
    readResource,
    listResources,
    
    // Prompt access
    getPrompt,
    listPrompts,
    
    // OAuth
    authUrl,
    clearStorage,
  };
}
