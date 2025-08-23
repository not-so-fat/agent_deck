# Agent Deck

## What does it solve?

<img src="./misc/CursorTooManyTools.png" alt="Cursor Too Many Tools" width="60%" />

When I use Cursor, there are different contexts;
- Coding
- Product documents writing
- Task management
- Testing new MCP services

in total, many MCP servers would help, but agent will be slower / less accurate when too many servers are connected.
But for each context I don't need many servers.

## Idea: Local app for MCP access (like a browser for agents)

In local app you can manage what MCP servers you want to use, and provide a single MCP server to access anything.

## Architecture

This is a **TypeScript monorepo** built with **Turborepo** containing:

### **Packages:**
- **`@agent-deck/shared`** - Shared types, schemas, and utilities
- **`@agent-deck/backend`** - Fastify API server with SQLite database
- **`@agent-deck/mcp-server`** - MCP server that provides unified access to deck services

### **Apps:**
- **`apps/agent-deck`** - React frontend (coming soon - will integrate existing frontend)

## Supported Services

- **MCP servers**
  - [x] Remote MCP servers (HTTP, SSE)
  - [ ] Local MCP servers (planned)
- **A2A Agents**
  - [x] Agents with A2A agent card

## Features

### **Backend API Server**
- **Service Management**: Register, update, delete MCP and A2A services
- **Deck Management**: Create, update, delete decks with service collections
- **Health Monitoring**: Real-time service health checking
- **OAuth Support**: OAuth 2.0 discovery and UI (flow implementation in progress)
- **WebSocket**: Real-time updates for service status changes

### **MCP Server**
- **Unified Interface**: Single MCP server that routes to active deck services
- **Tool Discovery**: List all tools from services in active deck
- **Tool Calling**: Call tools from any service in active deck
- **Resource Access**: Access resources from deck services
- **Prompt Management**: List and retrieve prompts from services
- **Database Integration**: Automatically reads active deck from database

### **Frontend** (Coming Soon)
- **Cyberpunk-themed UI** with card-based interface
- **Drag & Drop**: Build decks by dragging service cards
- **Real-time Updates**: Live service health monitoring
- **Service Registration**: Add MCP and A2A services
- **Deck Management**: Create and manage multiple decks
- **Search & Filter**: Find services quickly

## Quick Start

### **Prerequisites**
- Node.js 18+
- npm or yarn

### **Installation**
```bash
git clone <repository>
cd agent-deck
npm install
```

### **Development**
```bash
# Build all packages
npm run build

# Start development servers
npm run dev

# Run tests
npm test
```

### **Running Individual Services**

#### **Backend API Server**
```bash
cd packages/backend
npm run dev
# Server runs on http://localhost:8000
```

#### **MCP Server**
```bash
cd packages/mcp-server
npm run build
node dist/index.js
# MCP server communicates via stdio
```

## API Endpoints

### **Services**
- `GET /api/services` - List all services
- `POST /api/services` - Create new service
- `GET /api/services/:id` - Get service details
- `PUT /api/services/:id` - Update service
- `DELETE /api/services/:id` - Delete service
- `GET /api/services/:id/tools` - Discover service tools
- `POST /api/services/:id/call` - Call service tool
- `GET /api/services/:id/health` - Check service health

### **Decks**
- `GET /api/decks` - List all decks
- `POST /api/decks` - Create new deck
- `GET /api/decks/active` - Get active deck
- `GET /api/decks/:id` - Get deck details
- `PUT /api/decks/:id` - Update deck
- `DELETE /api/decks/:id` - Delete deck
- `POST /api/decks/:id/activate` - Set as active deck
- `POST /api/decks/:id/services` - Add service to deck
- `DELETE /api/decks/:id/services` - Remove service from deck
- `PUT /api/decks/:id/services/reorder` - Reorder deck services

### **OAuth** ⚠️ **Discovery Complete, Flow in Progress**
- `GET /api/oauth/:serviceId/discover` - Discover OAuth config ✅
- `GET /api/oauth/:serviceId/authorize` - Initiate OAuth flow ⚠️ **Not implemented**
- `GET /api/oauth/:serviceId/callback` - Handle OAuth callback ⚠️ **Not implemented**
- `POST /api/oauth/:serviceId/refresh` - Refresh OAuth token ⚠️ **Not implemented**
- `GET /api/oauth/:serviceId/status` - Get OAuth status ⚠️ **Not implemented**

**Current Status:**
- ✅ OAuth discovery working (automatically detects OAuth requirements)
- ✅ OAuth UI integration complete (shows OAuth setup instructions)
- ❌ OAuth flow not yet implemented (authorization, callback, token management)

### **WebSocket**
- `WS /api/ws/events` - Real-time updates

## MCP Server Usage

The MCP server provides a unified interface to all services in the active deck:

### **Tools**
- **List Tools**: Returns all tools from services in active deck
- **Call Tool**: Calls tools using format `serviceName:toolName`

### **Resources**
- **List Resources**: Returns all resources from deck services
- **Read Resource**: Access resources using format `serviceName:resourceUri`

### **Prompts**
- **List Prompts**: Returns all prompts from deck services
- **Get Prompt**: Retrieve prompts using format `serviceName:promptName`

## Database Schema

### **Services Table**
- `id` (TEXT PRIMARY KEY)
- `name` (TEXT NOT NULL)
- `type` (TEXT NOT NULL) - 'mcp' or 'a2a'
- `url` (TEXT NOT NULL)
- `health` (TEXT DEFAULT 'unknown')
- `description` (TEXT)
- `card_color` (TEXT DEFAULT '#7ed4da')
- `is_connected` (INTEGER DEFAULT 0)
- `last_ping` (TEXT)
- `registered_at` (TEXT NOT NULL)
- `updated_at` (TEXT NOT NULL)
- OAuth fields for authentication

### **Decks Table**
- `id` (TEXT PRIMARY KEY)
- `name` (TEXT NOT NULL)
- `description` (TEXT)
- `is_active` (INTEGER DEFAULT 0)
- `created_at` (TEXT NOT NULL)
- `updated_at` (TEXT NOT NULL)

### **Deck Services Table**
- `deck_id` (TEXT NOT NULL)
- `service_id` (TEXT NOT NULL)
- `position` (INTEGER NOT NULL)

## Development

### **Project Structure**
```
agent-deck/
├── packages/
│   ├── shared/           # Shared types, schemas, utilities
│   ├── backend/          # Fastify API server
│   └── mcp-server/       # MCP server implementation
├── apps/
│   └── agent-deck/       # React frontend (coming soon)
├── old_impl/             # Original Python implementation
└── misc/                 # Documentation and assets
```

### **Testing**
```bash
# Run all tests
npm test

# Run tests for specific package
cd packages/backend && npm test
cd packages/mcp-server && npm test
cd packages/shared && npm test
```

### **Building**
```bash
# Build all packages
npm run build

# Build specific package
cd packages/backend && npm run build
```

## Integration Plan

### **Phase 1: Frontend Integration** ✅
- [x] Set up TypeScript monorepo with Turborepo
- [x] Implement shared package with types and schemas
- [x] Build backend API server with Fastify
- [x] Create MCP server for unified service access
- [x] Comprehensive testing suite

### **Phase 2: Frontend Migration** 🔄
- [ ] Migrate existing React frontend to `apps/agent-deck`
- [ ] Update API calls to use new backend endpoints
- [ ] Integrate with new shared types and schemas
- [ ] Maintain existing UI/UX design and functionality

### **Phase 3: Enhanced Features** 📋
- [ ] Local MCP server support
- [ ] Advanced deck management features
- [ ] Service templates and presets
- [ ] Performance optimizations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

ISC License - see LICENSE file for details. 