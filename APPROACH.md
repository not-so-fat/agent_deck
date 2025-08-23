# Agent Deck - TypeScript Implementation Approach

## Overview

This document outlines the approach for rebuilding Agent Deck using a full TypeScript stack, maintaining the database as the single source of truth while providing better type safety, developer experience, and maintainability.

## Architecture Decision

### Why Full TypeScript Stack?

1. **Type Safety Across Stack**: Shared types between frontend, backend, and MCP server
2. **Better Developer Experience**: Consistent tooling, debugging, and IDE support
3. **Code Reuse**: Shared utilities, validation schemas, and business logic
4. **Easier Port Management**: Single runtime (Node.js) with better port coordination
5. **Modern Ecosystem**: Access to latest TypeScript/Node.js features and libraries
6. **Unified Testing**: Same testing framework (Jest/Vitest) across the stack
7. **Better Error Handling**: Consistent error types and handling patterns

### Migration Strategy

**Gradual Migration Approach** (not rewrite from scratch):
1. **Phase 1**: Create TypeScript backend alongside existing Python backend
2. **Phase 2**: Implement TypeScript MCP server
3. **Phase 3**: Build React frontend in TypeScript
4. **Phase 4**: Migrate data and remove Python backend

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
│   ├── mcp-server/              # MCP server implementation
│   │   ├── src/
│   │   │   ├── server/          # MCP server setup
│   │   │   ├── tools/           # MCP tool definitions
│   │   │   ├── resources/       # MCP resource definitions
│   │   │   ├── services/        # Service integration
│   │   │   └── types/           # MCP-specific types
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── frontend/                # React/Next.js frontend
│   │   ├── src/
│   │   │   ├── components/      # React components
│   │   │   ├── pages/           # Next.js pages
│   │   │   ├── hooks/           # Custom hooks
│   │   │   ├── services/        # API services
│   │   │   └── types/           # Frontend types
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
│   └── agent-deck/              # Main application entry point
│       ├── src/
│       │   └── index.ts         # Application startup
│       ├── package.json
│       └── tsconfig.json
├── tools/
│   ├── dev-server/              # Development server
│   └── build/                   # Build tools
├── package.json                 # Root package.json (workspace)
├── turbo.json                   # Turborepo configuration
└── README.md
```

## Data Models & Database as Source of Truth

### Core Philosophy

**Database as Single Source of Truth**: All data persistence happens through the database. The TypeScript backend provides a type-safe API layer that:
- Validates all inputs using Zod schemas
- Ensures data consistency
- Provides proper error handling
- Maintains the existing SQLite database structure

### Database Schema (Maintained from Python Implementation)

```sql
-- Services table (enhanced with OAuth)
CREATE TABLE services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('mcp', 'a2a')),
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
    oauth_state TEXT
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

### TypeScript Type Definitions (Shared)

```typescript
// packages/shared/src/types/service.ts
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

// packages/shared/src/types/api.ts
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### Zod Validation Schemas (Shared)

```typescript
// packages/shared/src/schemas/service.ts
import { z } from 'zod';

export const ServiceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['mcp', 'a2a']),
  url: z.string().url('Valid URL is required'),
  health: z.enum(['unknown', 'healthy', 'unhealthy']).default('unknown'),
  description: z.string().optional(),
  cardColor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Valid hex color required'),
  isConnected: z.boolean().default(false),
  lastPing: z.string().datetime().optional(),
  registeredAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  headers: z.record(z.string()).optional(),
  
  // OAuth fields
  oauthClientId: z.string().optional(),
  oauthClientSecret: z.string().optional(),
  oauthAuthorizationUrl: z.string().url().optional(),
  oauthTokenUrl: z.string().url().optional(),
  oauthRedirectUri: z.string().url().optional(),
  oauthScope: z.string().optional(),
  oauthAccessToken: z.string().optional(),
  oauthRefreshToken: z.string().optional(),
  oauthTokenExpiresAt: z.string().datetime().optional(),
  oauthState: z.string().optional(),
});

export const CreateServiceSchema = ServiceSchema.omit({
  id: true,
  health: true,
  isConnected: true,
  lastPing: true,
  registeredAt: true,
  updatedAt: true,
  oauthAccessToken: true,
  oauthRefreshToken: true,
  oauthTokenExpiresAt: true,
  oauthState: true,
});

export const UpdateServiceSchema = CreateServiceSchema.partial();
```

## Technology Stack

### Backend (packages/backend)
- **Runtime**: Node.js 18+
- **Framework**: Fastify (fast, low overhead web framework)
- **Database**: SQLite with better-sqlite3
- **ORM**: Prisma (type-safe database client)
- **Validation**: Zod
- **Testing**: Vitest
- **Real-time**: Socket.io

### MCP Server (packages/mcp-server)
- **Runtime**: Node.js 18+
- **MCP SDK**: @modelcontextprotocol/sdk
- **Transport**: StdioServerTransport (local communication)
- **Validation**: Zod
- **Testing**: Vitest

### Frontend (packages/frontend)
- **Framework**: Next.js 14 with App Router
- **UI**: React 18, TypeScript
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query + Zustand
- **Forms**: React Hook Form + Zod
- **Testing**: Vitest + Testing Library

### Shared (packages/shared)
- **Types**: TypeScript interfaces
- **Validation**: Zod schemas
- **Utilities**: Common utilities
- **Database**: Shared database utilities

### Build System
- **Monorepo**: Turborepo
- **Package Manager**: pnpm
- **TypeScript**: Strict mode
- **Linting**: ESLint + Prettier

## Current Status Summary

### ✅ Completed Components
- **Monorepo Structure**: Turborepo setup with shared, backend, and MCP server packages
- **Shared Package**: Comprehensive types, schemas, and utilities with full test coverage
- **Backend API Server**: Fastify server with SQLite database, full CRUD operations, OAuth support, and WebSocket
- **MCP Server**: Complete MCP server implementation with unified access to active deck services
- **Testing**: 81/81 tests passing across all packages

### 🔄 In Progress
- **Frontend Integration**: Migrating existing React frontend to work with new backend

### 📋 Planned
- **Enhanced Features**: Local MCP servers, advanced deck management, service templates

## Implementation Phases
1. **Setup monorepo structure** with Turborepo
2. **Create shared package** with types and schemas
3. **Implement backend package** with Fastify
4. **Database integration** with Prisma
5. **API routes** for services and decks
6. **OAuth integration** for MCP services
7. **WebSocket support** for real-time updates

### Phase 2: MCP Server
1. **Setup MCP server package**
2. **Implement MCP tools** for deck management
3. **Service proxy tools** for calling active deck services
4. **OAuth integration** in MCP server
5. **Error handling** and validation
6. **Testing** MCP server functionality

### Phase 3: Frontend
1. **Setup Next.js frontend**
2. **Implement components** (cards, modals, forms)
3. **State management** with TanStack Query
4. **Real-time updates** with WebSocket
5. **OAuth flow** integration
6. **Drag & drop** functionality
7. **Testing** frontend components

### Phase 4: Integration & Migration
1. **End-to-end testing**
2. **Performance optimization**
3. **Documentation** updates
4. **Data migration** from Python backend
5. **Deployment** setup
6. **Remove Python backend**

## Key Implementation Details

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

### MCP Tool Pattern
```typescript
// packages/mcp-server/src/tools/deck-tools.ts
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

## Benefits of This Approach

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

1. **Initialize monorepo** with Turborepo
2. **Create shared package** with types and schemas
3. **Setup backend package** with Fastify and Prisma
4. **Implement core API routes** for services and decks
5. **Add OAuth integration** for MCP services
6. **Setup MCP server package** with basic tools
7. **Begin frontend development** with Next.js

This approach ensures we maintain all existing functionality while gaining the benefits of a modern TypeScript stack with better type safety, developer experience, and maintainability.
