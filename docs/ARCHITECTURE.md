# Agent Deck - Technical Architecture

## Overview

Agent Deck is a local application that acts as a "browser for agents" to manage MCP servers and services. It provides a clean, modern interface for managing decks of AI services and integrates with the Model Context Protocol (MCP).

## Architecture Decision

### Why Full TypeScript Stack?

1. **Type Safety Across Stack**: Shared types between frontend, backend, and MCP server
2. **Better Developer Experience**: Consistent tooling, debugging, and IDE support
3. **Code Reuse**: Shared utilities, validation schemas, and business logic
4. **Easier Port Management**: Single runtime (Node.js) with better port coordination
5. **Modern Ecosystem**: Access to latest TypeScript/Node.js features and libraries
6. **Unified Testing**: Same testing framework (Jest/Vitest) across the stack
7. **Better Error Handling**: Consistent error types and handling patterns

## System Architecture

```
┌─────────────┐    ┌─────────────┐
│   Frontend  │    │ MCP Server  │
│   (Port 3000)│    │ (Port 3001) │
└─────────────┘    └─────────────┘
       │                   │
       └───────────────────┘
                           │
                    ┌─────────────┐
                    │   Backend   │
                    │     API     │
                    │ (Port 8000) │
                    └─────────────┘
                           │
                    ┌─────────────┐
                    │  Database   │
                    │ (SQLite)    │
                    └─────────────┘
```

## Components

### 1. **Frontend** (`apps/agent-deck/`)
- **Technology**: React + Vite + TypeScript + Shadcn/ui
- **Port**: 3000
- **Purpose**: Modern web UI for managing decks and services
- **Features**: 
  - Real-time updates via WebSocket
  - Drag-and-drop deck building
  - Cyberpunk theme with modern design
  - Service health monitoring
  - OAuth integration UI

### 2. **Backend API** (`packages/backend/`)
- **Technology**: Node.js + Fastify + TypeScript
- **Port**: 8000
- **Purpose**: Main API server with business logic
- **Features**: 
  - RESTful API for services and decks
  - SQLite database management
  - WebSocket for real-time updates
  - OAuth 2.0 implementation
  - Service health monitoring

### 3. **MCP Server** (`packages/backend/src/mcp-server.ts`)
- **Technology**: Node.js + Official MCP SDK + Express
- **Port**: 3001
- **Purpose**: MCP protocol server for agent integration
- **Features**: 
  - Official MCP SDK integration
  - HTTP transport with session management
  - Unified access to active deck services
  - Tool discovery and execution
  - Resource access

### 4. **Shared Package** (`packages/shared/`)
- **Technology**: TypeScript + Zod
- **Purpose**: Shared types, schemas, and utilities
- **Features**:
  - TypeScript interfaces for all data models
  - Zod validation schemas
  - Common utility functions
  - Database utilities

## Project Structure

```
agent_deck/
├── packages/
│   ├── backend/                 # Fastify API server
│   │   ├── src/
│   │   │   ├── server/          # Fastify server setup
│   │   │   ├── routes/          # API routes
│   │   │   ├── services/        # Business logic
│   │   │   ├── models/          # Database models
│   │   │   ├── utils/           # Utilities
│   │   │   └── types/           # TypeScript types
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── shared/                  # Shared types and utilities
│       ├── src/
│       │   ├── types/           # Shared TypeScript types
│       │   ├── schemas/         # Zod validation schemas
│       │   ├── database/        # Database utilities
│       │   └── utils/           # Shared utilities
│       ├── package.json
│       └── tsconfig.json
├── apps/
│   └── agent-deck/              # React frontend
│       ├── src/
│       │   ├── components/      # React components
│       │   ├── pages/           # Application pages
│       │   ├── hooks/           # Custom hooks
│       │   ├── services/        # API services
│       │   └── types/           # Frontend types
│       ├── package.json
│       └── tsconfig.json
├── scripts/
│   └── dev-all.sh               # One-command launcher
├── docs/                        # Documentation
├── package.json                 # Root package.json (workspace)
├── turbo.json                   # Turborepo configuration
└── README.md
```

## Data Models & Database Schema

### Core Philosophy

**Database as Single Source of Truth**: All data persistence happens through the database. The TypeScript backend provides a type-safe API layer that:
- Validates all inputs using Zod schemas
- Ensures data consistency
- Provides proper error handling
- Maintains the existing SQLite database structure

### Database Schema

```sql
-- Services table (enhanced with OAuth and Local MCP support)
CREATE TABLE services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
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
);

-- Decks table
CREATE TABLE decks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Deck services junction table
CREATE TABLE deck_services (
    deck_id TEXT NOT NULL,
    service_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    FOREIGN KEY (deck_id) REFERENCES decks (id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE,
    PRIMARY KEY (deck_id, service_id)
);
```

### TypeScript Type Definitions

```typescript
// packages/shared/src/types/service.ts
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
  oauthState?: string;
  
  // Local MCP server fields
  localCommand?: string;
  localArgs?: string[];
  localWorkingDir?: string;
  localEnv?: Record<string, string>;
}

// Local MCP server configuration types
export interface LocalMCPServerConfig {
  command: string;
  args: string[];
  workingDir?: string;
  env?: Record<string, string>;
}

export interface MCPServersManifest {
  mcpServers: Record<string, LocalMCPServerConfig>;
}

export interface LocalMCPServerProcess {
  id: string;
  serviceId: string;
  process: any; // Node.js ChildProcess
  isRunning: boolean;
  startTime: Date;
  lastActivity: Date;
  capabilities?: {
    tools: ServiceTool[];
    resources: any[];
    prompts: string[];
  };
}

// packages/shared/src/types/deck.ts
export interface Deck {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  services: Service[];
  createdAt: string;
  updatedAt: string;
}
```

## Technology Stack

### Backend (packages/backend)
- **Runtime**: Node.js 20+
- **Framework**: Fastify (fast, low overhead web framework)
- **Database**: SQLite with better-sqlite3
- **Validation**: Zod
- **Testing**: Vitest
- **Real-time**: WebSocket

### MCP Server (packages/backend/src/mcp-server.ts)
- **Runtime**: Node.js 20+
- **MCP SDK**: @modelcontextprotocol/sdk
- **Transport**: HTTP transport with session management
- **Validation**: Zod
- **Testing**: Vitest

### Frontend (apps/agent-deck)
- **Framework**: React 18 + Vite + TypeScript
- **UI**: Shadcn/ui + Tailwind CSS
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Real-time**: WebSocket integration
- **Testing**: Vitest + Testing Library
- **Service Registration**: Tabbed modal for Remote MCP and Local MCP servers
- **Service Display**: Clear type distinction (Remote MCP, Local MCP, A2A)
- **Local MCP Management**: Environment variables, command validation, process lifecycle

### Shared (packages/shared)
- **Types**: TypeScript interfaces
- **Validation**: Zod schemas
- **Utilities**: Common utilities
- **Database**: Shared database utilities

### Build System
- **Monorepo**: Turborepo
- **Package Manager**: npm
- **TypeScript**: Strict mode
- **Linting**: ESLint + Prettier

## Key Design Decisions

### ✅ **Single Source of Truth**
- Backend API is the authoritative data source
- MCP Server calls backend API (not direct database access)
- No code duplication between services

### ✅ **Proper Architecture**
- Clear separation of concerns
- Each component has a specific responsibility
- Scalable and maintainable design

### ✅ **MCP Standards Compliance**
- Uses official `@modelcontextprotocol/sdk`
- Proper HTTP transport with session management
- Follows MCP protocol specifications

## MCP Server Architecture

### Overview
The MCP server provides a unified interface to all services in the active deck. It acts as a proxy, routing MCP calls to the appropriate services while maintaining a single connection point for MCP clients.

### Available MCP Tools
1. `get_decks` - Get all available decks
2. `get_active_deck` - Get currently active deck with services
3. `list_active_deck_services` - List services in active deck
4. `list_service_tools(serviceId)` - Discover tools for a service in the active deck
5. `call_service_tool(serviceId, toolName, arguments?)` - Call a tool on a service from the active deck

### Available MCP Resources
1. `agent-deck://decks` - List of all available decks
2. `agent-deck://active-deck` - The currently active deck
3. `agent-deck://active-deck/services` - Services in the currently active deck

## Local MCP Server Architecture

### Overview
Local MCP servers are spawned as subprocesses and communicate via stdio transport. This allows users to run MCP servers locally without needing to set up HTTP endpoints.

### Key Components

#### **LocalMCPServerManager**
- **Purpose**: Manages local MCP server processes
- **Features**: 
  - Subprocess spawning and lifecycle management
  - Stdio transport integration with MCP SDK
  - Capability discovery and caching
  - Process monitoring and cleanup

#### **ConfigManager**
- **Purpose**: Handles JSON configuration parsing and validation
- **Features**:
  - Parse mcpServers manifests
  - Validate command safety and environment variables
  - Convert configurations to service definitions
  - Generate sample configurations

### Configuration Format
```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"],
      "env": {
        "MCP_SERVER_FILESYSTEM_ROOT": "/path/to/root"
      }
    }
  }
}
```

### Security Features
- **Command Validation**: Blocks unsafe commands (rm, sudo, etc.)
- **Environment Sanitization**: Only allows safe environment variable names
- **Process Isolation**: Each server runs in its own process
- **User Trust Model**: Assumes local environment trust

### Integration with Existing Architecture
- **Unified Interface**: Local servers appear in the same MCP interface
- **Automatic Discovery**: Tools and capabilities discovered automatically
- **Seamless Routing**: MCP calls routed to appropriate local or remote servers
- **Health Monitoring**: Integrated with existing health check system
- **On-Demand Startup**: Local MCP servers are started only when first accessed, not on system startup

### **On-Demand Local MCP Server Startup**

Local MCP servers use an **on-demand startup** approach rather than automatic startup on system boot:

#### **Design Decision**
- **Fast System Startup**: The main system starts quickly without waiting for local MCP servers
- **Resource Efficiency**: Only starts servers that are actually used
- **Better Error Isolation**: Startup failures don't block the entire system
- **Improved User Experience**: Users get immediate access to the system

#### **Implementation**
```typescript
// In MCPClientManager.getClient()
if (service.type === 'local-mcp') {
  // Check if server is already running
  if (!this.localServerManager.isLocalServerRunning(service.id)) {
    // Start the server on first access
    await this.localServerManager.startLocalServer(service);
  }
  return this.localServerManager.getClient(service.id);
}
```

#### **Benefits**
- ✅ **Fast System Startup**: No waiting for potentially slow local servers
- ✅ **Resource Efficiency**: Only starts servers that are actually needed
- ✅ **Better Error Isolation**: Startup failures don't block the entire system
- ✅ **User Experience**: Users get immediate access to the system
- ✅ **Graceful Degradation**: If a local server fails to start, it only affects that specific service

#### **Lifecycle**
1. **System Startup**: Main system starts quickly, local MCP servers remain stopped
2. **First Access**: When a local MCP server is first accessed, it's started automatically
3. **Subsequent Access**: Server remains running for subsequent requests
4. **System Shutdown**: All local MCP servers are properly stopped and cleaned up

### Frontend Integration Plan

#### **Service Registration Modal**
- **Tabbed Interface**: Single modal with "Remote MCP Server" and "Local MCP Server" tabs
- **Remote MCP Tab**: Existing MCP server registration form
- **Local MCP Tab**: New form with command, arguments, and environment variables

#### **Local MCP Form Fields**
- **Name**: Required, must be unique across all services
- **Command**: Required, validated for safety (e.g., "npx", "python")
- **Arguments**: Array of strings (e.g., ["-y", "@modelcontextprotocol/server-memory"])
- **Environment Variables**: Optional key-value pairs for server configuration

#### **Service Card Display**
- **Remote MCP**: Shows "Remote MCP" badge and "RM" corner indicator
- **Local MCP**: Shows "Local MCP" badge and "LM" corner indicator
- **A2A**: Shows "A2A" badge and "A" corner indicator

#### **User Experience Flow**
1. **Click "Register MCP"** → Opens tabbed modal (Remote MCP selected by default)
2. **Switch to "Local MCP Server" tab** → Shows local server form
3. **Fill form** → Name, command, arguments, environment variables
4. **Submit** → Validation → Import → Start server → Success feedback
5. **Result** → Service appears in collection with "Local MCP" badge

### **Unified Service Architecture**

Local MCP servers are **services first**, not independent entities. They integrate seamlessly into the existing service architecture:

#### **Single API for All Services**
All services, regardless of type, use the same API endpoints:
- `POST /api/services/:id/call` - Call tools on any service (unified)
- `GET /api/services/:id/tools` - Discover tools for any service
- `GET /api/services/:id/health` - Check health of any service

#### **Internal Routing**
The `MCPClientManager` handles routing internally:
```typescript
// Unified service calling - same API for all service types
if (service.type === 'mcp' || service.type === 'a2a') {
  // Use HTTP/SSE transport for remote services
  return this.httpClient.callTool(service, toolName, arguments);
} else if (service.type === 'local-mcp') {
  // Use stdio transport for local services
  return this.localServerManager.callTool(service.id, toolName, arguments);
}
```

#### **Management vs. Usage**
- **Management Endpoints** (`/api/local-mcp/*`): Only for process lifecycle (start/stop/import)
- **Usage Endpoints** (`/api/services/*`): For all service operations (call tools, discover capabilities)

#### **User Experience**
Users interact with local MCP servers exactly like any other service:
1. Import configuration → Creates services in database
2. Add to deck → Same as any other service
3. Call tools → Same unified API
4. Monitor health → Same health check system

#### **Architecture Flow**
```
┌─────────────────────────────────────────────────────────┐
│                    Active Deck                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ MCP Service │  │ A2A Service │  │Local MCP    │     │
│  │ (Remote)    │  │ (Remote)    │  │Service      │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
                    POST /api/services/:id/call
                              │
                              ▼
                    ┌─────────────────┐
                    │ Service Manager │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ MCP Client      │
                    │ Manager         │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Route to:       │
                    │ • HTTP/SSE      │
                    │ • Local MCP     │
                    │   (stdio)       │
                    └─────────────────┘
```

This design ensures **consistency**, **simplicity**, and **maintainability** across all service types.

### Implementation Pattern
```typescript
// Example MCP tool implementation
server.tool(
  "get_active_deck",
  "Get the currently active deck with all its services",
  {
    input: z.object({}),
  },
  async () => {
    try {
      const activeDeck = await deckService.getActiveDeck();
      return {
        success: true,
        data: activeDeck,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
);
```

## API Architecture

### RESTful Endpoints

#### Services
- `GET /api/services` - List all services
- `POST /api/services` - Create new service
- `GET /api/services/:id` - Get service details
- `PUT /api/services/:id` - Update service
- `DELETE /api/services/:id` - Delete service
- `POST /api/services/:id/call` - Call service tool

#### Decks
- `GET /api/decks` - List all decks
- `POST /api/decks` - Create new deck
- `GET /api/decks/:id` - Get deck details
- `PUT /api/decks/:id` - Update deck
- `DELETE /api/decks/:id` - Delete deck
- `GET /api/decks/active` - Get active deck
- `POST /api/decks/:id/activate` - Activate deck

#### OAuth
- `GET /api/oauth/:serviceId/authorize` - Start OAuth flow
- `GET /api/oauth/:serviceId/callback` - OAuth callback

#### Local MCP Servers
- `POST /api/local-mcp/import` - Import local servers from JSON configuration
- `GET /api/local-mcp/sample-config` - Get sample configuration
- `POST /api/local-mcp/:serviceId/start` - Start a local MCP server
- `POST /api/local-mcp/:serviceId/stop` - Stop a local MCP server
- `GET /api/local-mcp/:serviceId/status` - Get local server status
- `GET /api/local-mcp/list` - List all local MCP servers

#### WebSocket
- `WS /ws` - Real-time updates for service status

### Response Pattern
```typescript
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

## Development Patterns

### Database Access Pattern
```typescript
// packages/backend/src/services/service-manager.ts
export class ServiceManager {
  constructor(private db: Database) {}
  
  async createService(data: CreateServiceInput): Promise<Service> {
    // Validate input with Zod
    const validatedData = CreateServiceSchema.parse(data);
    
    // Generate ID and timestamps
    const service: Service = {
      id: generateId(),
      ...validatedData,
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Save to database
    await this.db.insertService(service);
    
    return service;
  }
}
```

### API Response Pattern
```typescript
// packages/backend/src/routes/services.ts
export async function createServiceHandler(
  request: FastifyRequest<{ Body: CreateServiceInput }>,
  reply: FastifyReply
): Promise<ApiResponse<Service>> {
  try {
    const service = await serviceManager.createService(request.body);
    return {
      success: true,
      data: service,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}
```

## Current Status

### ✅ Completed Components
- **Monorepo Structure**: Turborepo setup with shared, backend, and frontend packages
- **Shared Package**: Comprehensive types, schemas, and utilities with full test coverage
- **Backend API Server**: Fastify server with SQLite database, full CRUD operations, OAuth support, and WebSocket
- **MCP Server**: Complete MCP server implementation with unified access to active deck services
- **Local MCP Servers**: Full support for local MCP servers with stdio transport, configuration management, and security features
- **Frontend**: React application with modern UI and real-time updates
- **Testing**: 81/81 tests passing across all packages

### 🔄 In Progress
- **OAuth Flow Implementation**: OAuth discovery and UI are complete, flow implementation in progress

### 📋 Planned
- **Enhanced Features**: Advanced deck management, service templates, Docker containerization for local servers
- **Frontend Integration**: Local MCP server UI integration with tabbed registration modal

## Benefits of This Architecture

1. **Type Safety**: Full TypeScript coverage with shared types
2. **Database Integrity**: Maintains existing database as source of truth
3. **Gradual Migration**: Can run alongside Python backend during transition
4. **Better Developer Experience**: Modern tooling and hot reload
5. **Performance**: Node.js performance with proper optimization
6. **Maintainability**: Clear separation of concerns and modular architecture
7. **Testing**: Comprehensive testing across all layers
8. **OAuth Support**: Built-in OAuth handling for protected services
9. **Real-time**: WebSocket support for live updates
10. **Scalability**: Monorepo structure allows for easy scaling

## Next Steps

1. **Complete OAuth Flow**: Finish OAuth implementation
2. **Enhanced Features**: Add local MCP server support
3. **Advanced Deck Management**: Leverage new backend capabilities
4. **Service Templates**: Add pre-configured service templates
5. **Performance Optimization**: Optimize for large numbers of services
6. **Security Enhancements**: Add authentication and authorization

This architecture ensures we maintain all existing functionality while gaining the benefits of a modern TypeScript stack with better type safety, developer experience, and maintainability.
