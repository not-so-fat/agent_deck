# Agent Deck Integration Plan

## Overview

This document outlines the plan for integrating the existing React frontend with the new TypeScript backend and MCP server implementation.

## Current State Analysis

### **Existing Frontend** (`old_impl/frontend/`)
- **Technology**: React + TypeScript + Vite
- **UI Framework**: Shadcn/ui + Tailwind CSS
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Real-time**: WebSocket connections
- **Design**: Cyberpunk theme with card-based interface

### **New Backend** (`packages/backend/`)
- **Technology**: Fastify + TypeScript
- **Database**: SQLite with better-sqlite3
- **API**: RESTful endpoints for services and decks
- **Real-time**: WebSocket support
- **OAuth**: Full OAuth 2.0 implementation

### **New MCP Server** (`packages/mcp-server/`)
- **Technology**: TypeScript + @modelcontextprotocol/sdk
- **Transport**: StdioServerTransport
- **Features**: Unified access to active deck services

## Integration Strategy

### **Phase 1: Frontend Migration** 🔄

#### **1.1 Setup New Frontend App**
```bash
# Create new frontend app in monorepo
mkdir -p apps/agent-deck
cd apps/agent-deck
```

#### **1.2 Migrate Dependencies**
Copy and update dependencies from `old_impl/frontend/package.json`:

**Core Dependencies:**
- React 18.3.1
- TypeScript 5.6.3
- Vite 5.4.19
- TanStack Query 5.60.5
- Wouter 3.3.5

**UI Dependencies:**
- Shadcn/ui components
- Tailwind CSS 3.4.17
- Framer Motion 11.13.1
- Lucide React 0.453.0

**Development Dependencies:**
- @vitejs/plugin-react
- @types/react, @types/react-dom
- Vitest for testing

#### **1.3 Migrate Source Code**
1. **Copy Components**: Migrate all components from `old_impl/frontend/client/src/components/`
2. **Copy Pages**: Migrate pages from `old_impl/frontend/client/src/pages/`
3. **Copy Hooks**: Migrate custom hooks from `old_impl/frontend/client/src/hooks/`
4. **Copy Utilities**: Migrate utility functions from `old_impl/frontend/client/src/lib/`
5. **Copy Types**: Migrate type definitions from `old_impl/frontend/client/src/types/`

#### **1.4 Update API Integration**
**Current API Calls** → **New Backend Endpoints**

| Current | New Backend | Notes |
|---------|-------------|-------|
| `GET /api/services` | `GET /api/services` | ✅ Compatible |
| `POST /api/services` | `POST /api/services` | ✅ Compatible |
| `DELETE /api/services/:id` | `DELETE /api/services/:id` | ✅ Compatible |
| `GET /api/decks` | `GET /api/decks` | ✅ Compatible |
| `POST /api/decks` | `POST /api/decks` | ✅ Compatible |
| `GET /api/decks-active` | `GET /api/decks/active` | ⚠️ URL change |
| `POST /api/decks/:id/update` | `PUT /api/decks/:id` | ⚠️ Method change |

**Required Changes:**
1. Update API endpoint URLs in `apiRequest` calls
2. Update HTTP methods where needed
3. Update request/response data structures to match new schemas

#### **1.5 Update Type Definitions**
Replace existing types with shared package types:

```typescript
// Old: @shared/schema
import { Service, Deck } from '@agent-deck/shared';

// Update component props and state to use new types
```

#### **1.6 WebSocket Integration**
**Current WebSocket**: Custom implementation
**New Backend**: Fastify WebSocket plugin

**Migration Steps:**
1. Update WebSocket connection URL to new backend
2. Update message format to match new backend
3. Test real-time updates for service health

### **Phase 2: API Compatibility Layer** 🔧

#### **2.1 Create Compatibility Adapters**
If needed, create adapter functions to maintain compatibility:

```typescript
// Example: API compatibility adapter
export const apiAdapter = {
  // Convert old API calls to new format
  getActiveDeck: () => apiRequest('GET', '/api/decks/active'),
  
  // Convert response formats
  transformDeckResponse: (response: any) => ({
    ...response,
    serviceIds: response.services?.map((s: any) => s.id) || []
  })
};
```

#### **2.2 Update Data Fetching**
Update TanStack Query hooks to use new API:

```typescript
// Update query keys and API calls
const { data: servicesResponse } = useQuery({
  queryKey: ['services'],
  queryFn: () => apiRequest('GET', '/api/services').then(r => r.json())
});
```

### **Phase 3: MCP Server Integration** 🔗

#### **3.1 Frontend MCP URL Display**
Update the "Get MCP URL" functionality:

```typescript
// Current: Hardcoded URL
const mcpUrl = 'http://localhost:3001/mcp';

// New: Dynamic URL from backend
const { data: mcpConfig } = useQuery({
  queryKey: ['mcp-config'],
  queryFn: () => apiRequest('GET', '/api/mcp/config').then(r => r.json())
});
```

#### **3.2 MCP Server Status**
Add MCP server status indicator to frontend:

```typescript
// Add MCP server health check
const { data: mcpStatus } = useQuery({
  queryKey: ['mcp-status'],
  queryFn: () => apiRequest('GET', '/api/mcp/status').then(r => r.json()),
  refetchInterval: 30000 // Check every 30 seconds
});
```

### **Phase 4: Enhanced Features** ✨

#### **4.1 OAuth Integration** ⚠️ **OPEN ISSUE**
OAuth discovery and UI integration is implemented but OAuth flow is not yet working:

**✅ Completed:**
- OAuth discovery in MCP analysis (`/api/mcp/discover`)
- OAuth configuration display in frontend
- OAuth metadata fetching from `.well-known` endpoints
- Provider-specific setup instructions (GitHub, Notion)

**❌ Not Working:**
- OAuth flow initiation (`/api/oauth/:serviceId/authorize`)
- OAuth callback handling (`/api/oauth/:serviceId/callback`)
- OAuth token management and storage

**🔧 Next Steps:**
1. Implement OAuth flow endpoints in backend
2. Add OAuth credential configuration UI
3. Test OAuth flow with Notion MCP
4. Add OAuth token refresh functionality

```typescript
// TODO: Add OAuth fields to service registration form
const oauthFields = [
  'oauthClientId',
  'oauthClientSecret',
  'oauthAuthorizationUrl',
  'oauthTokenUrl',
  'oauthRedirectUri',
  'oauthScope'
];
```

#### **4.2 Advanced Deck Management**
Leverage new backend features:

- **Service Reordering**: Use new reorder endpoint
- **Deck Activation**: Use new activate endpoint
- **Service Health**: Use new health check endpoint

#### **4.3 Real-time Enhancements**
Improve WebSocket integration:

- **Service Status Updates**: Real-time health monitoring
- **Deck Changes**: Live deck updates
- **Connection Status**: Better connection indicators

## Implementation Steps

### **Step 1: Create New Frontend App**
```bash
# Create new frontend app
mkdir -p apps/agent-deck
cd apps/agent-deck

# Initialize package.json
npm init -y

# Install dependencies
npm install react react-dom @tanstack/react-query wouter
npm install -D @vitejs/plugin-react vite typescript
```

### **Step 2: Migrate Source Code**
```bash
# Copy source files
cp -r old_impl/frontend/client/src/* apps/agent-deck/src/
cp old_impl/frontend/client/index.html apps/agent-deck/
cp old_impl/frontend/tailwind.config.ts apps/agent-deck/
cp old_impl/frontend/vite.config.ts apps/agent-deck/
```

### **Step 3: Update Configuration**
```bash
# Update package.json
# Update tsconfig.json
# Update vite.config.ts
# Update tailwind.config.ts
```

### **Step 4: Update API Calls**
```typescript
// Update all apiRequest calls to use new endpoints
// Update response handling to match new schemas
// Update error handling
```

### **Step 5: Test Integration**
```bash
# Start backend
cd packages/backend && npm run dev

# Start frontend
cd apps/agent-deck && npm run dev

# Test all functionality
```

## Testing Strategy

### **Unit Tests**
- Test individual components with new API mocks
- Test API integration functions
- Test type compatibility

### **Integration Tests**
- Test full user workflows
- Test real-time updates
- Test error handling

### **E2E Tests**
- Test complete user journeys
- Test cross-browser compatibility
- Test performance

## Migration Checklist

### **Frontend Setup** ✅
- [ ] Create new frontend app in monorepo
- [ ] Install all required dependencies
- [ ] Copy source code from old frontend
- [ ] Update build configuration

### **API Integration** 🔄
- [ ] Update API endpoint URLs
- [ ] Update HTTP methods
- [ ] Update request/response formats
- [ ] Test all API calls

### **Type Integration** 🔄
- [ ] Replace old types with shared package types
- [ ] Update component props
- [ ] Update state definitions
- [ ] Fix type errors

### **WebSocket Integration** 🔄
- [ ] Update WebSocket connection
- [ ] Update message formats
- [ ] Test real-time updates
- [ ] Add error handling

### **MCP Integration** 🔄
- [ ] Add MCP server status
- [ ] Update MCP URL functionality
- [ ] Test MCP server connection
- [ ] Add MCP health monitoring

### **UI/UX Preservation** 🔄
- [ ] Maintain cyberpunk theme
- [ ] Preserve card-based interface
- [ ] Keep drag-and-drop functionality
- [ ] Maintain animations and effects

### **Testing** 🔄
- [ ] Write unit tests for new components
- [ ] Write integration tests
- [ ] Test all user workflows
- [ ] Performance testing

## Risk Mitigation

### **Backward Compatibility**
- Keep old frontend as backup
- Create API compatibility layer if needed
- Gradual migration approach

### **Data Migration**
- Ensure database schema compatibility
- Test data migration scripts
- Backup existing data

### **Performance**
- Monitor bundle size
- Optimize API calls
- Test with large datasets

## Success Criteria

### **Functional Requirements**
- [ ] All existing features work with new backend
- [ ] Real-time updates function correctly
- [ ] MCP server integration works
- [x] OAuth discovery implemented
- [x] OAuth UI integration completed
- [ ] OAuth flows work properly ⚠️ **OPEN ISSUE**

### **Performance Requirements**
- [ ] Page load times < 2 seconds
- [ ] API response times < 500ms
- [ ] WebSocket latency < 100ms
- [ ] Bundle size < 2MB

### **User Experience**
- [ ] UI/UX identical to original
- [ ] No regression in functionality
- [ ] Improved error handling
- [ ] Better loading states

## Timeline

### **Week 1: Setup & Migration**
- Create new frontend app
- Migrate source code
- Update dependencies

### **Week 2: API Integration**
- Update API calls
- Fix type issues
- Test basic functionality

### **Week 3: Advanced Features**
- WebSocket integration
- MCP server integration
- OAuth support

### **Week 4: Testing & Polish**
- Comprehensive testing
- Performance optimization
- Bug fixes

## Conclusion

This integration plan provides a structured approach to migrating the existing frontend to work with the new TypeScript backend and MCP server. The key is maintaining the existing UI/UX while leveraging the improved backend capabilities.

The migration should be done incrementally to minimize risk and ensure all functionality is preserved. The new architecture provides better type safety, improved performance, and enhanced features while maintaining the beloved cyberpunk aesthetic and card-based interface.
