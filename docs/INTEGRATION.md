# Agent Deck - Integration Guide

## Overview

This document provides comprehensive guidance for integrating Agent Deck with external systems, migrating from existing implementations, and understanding the integration architecture.

## Integration Architecture

### **System Components**
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

### **Integration Points**
1. **Frontend ↔ Backend**: RESTful API + WebSocket
2. **MCP Server ↔ Backend**: HTTP API calls
3. **External MCP Clients ↔ MCP Server**: MCP Protocol
4. **External Services ↔ Backend**: Service registration and calls

## MCP Server Integration

### **MCP Server Overview**
The MCP server provides a unified interface to all services in the active deck. It acts as a proxy, routing MCP calls to the appropriate services while maintaining a single connection point for MCP clients.

### **Connection Details**
- **URL**: `http://localhost:3001/mcp`
- **Transport**: HTTP with session management
- **Protocol**: Model Context Protocol (MCP)

### **Available MCP Tools**

#### **Deck Management**
1. `get_decks` - Get all available decks
2. `get_active_deck` - Get the currently active deck with services
3. `list_active_deck_services` - List services in the active deck

#### **Service Management**
4. `list_service_tools(serviceId)` - Discover tools for a specific service in the active deck
5. `call_service_tool(serviceId, toolName, arguments?)` - Call a tool on a service from the active deck

### **Available MCP Resources**
1. `agent-deck://decks` - List of all available decks
2. `agent-deck://active-deck` - The currently active deck
3. `agent-deck://active-deck/services` - Services in the currently active deck

### **MCP Client Integration Example**
```typescript
// Example: Using the MCP server with an MCP client
import { Client } from '@modelcontextprotocol/sdk/client';

const client = new Client({
  server: {
    url: 'http://localhost:3001/mcp'
  }
});

// List all tools from active deck
const tools = await client.listTools();

// Call a specific tool
const result = await client.callTool({
  name: 'fileManager:readFile',
  arguments: { path: '/path/to/file' }
});
```

### **Testing MCP Integration**
```bash
# Check MCP server status
curl http://localhost:3001/backend-status

# Check MCP server health
curl http://localhost:3001/health

# Test MCP endpoint (requires proper MCP client)
curl -H "Accept: application/json" http://localhost:3001/mcp
```

## API Integration

### **RESTful API Endpoints**

#### **Services API**
```bash
# List all services
GET /api/services

# Create new service
POST /api/services
{
  "name": "My Service",
  "type": "mcp",
  "url": "https://example.com/mcp",
  "description": "Service description"
}

# Get service details
GET /api/services/:id

# Update service
PUT /api/services/:id

# Delete service
DELETE /api/services/:id

# Call service tool
POST /api/services/:id/call
{
  "tool": "toolName",
  "arguments": {}
}
```

#### **Decks API**
```bash
# List all decks
GET /api/decks

# Create new deck
POST /api/decks
{
  "name": "My Deck",
  "description": "Deck description"
}

# Get deck details
GET /api/decks/:id

# Update deck
PUT /api/decks/:id

# Delete deck
DELETE /api/decks/:id

# Get active deck
GET /api/decks/active

# Activate deck
POST /api/decks/:id/activate
```

#### **OAuth API**
```bash
# Start OAuth flow
GET /api/oauth/:serviceId/authorize

# OAuth callback
GET /api/oauth/:serviceId/callback
```

### **WebSocket Integration**
```javascript
// Connect to WebSocket for real-time updates
const ws = new WebSocket('ws://localhost:8000/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'service_health_update':
      // Handle service health change
      break;
    case 'deck_update':
      // Handle deck change
      break;
    case 'service_added':
      // Handle new service
      break;
  }
};
```

### **API Response Format**
```typescript
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

## Frontend Integration

### **Frontend Architecture**
The frontend is built with React, TypeScript, and modern tooling:

- **Framework**: React 18 + Vite + TypeScript
- **UI**: Shadcn/ui + Tailwind CSS
- **State Management**: TanStack Query
- **Real-time**: WebSocket integration
- **Routing**: Wouter

### **API Integration Pattern**
```typescript
// Example: API integration in frontend
import { useQuery, useMutation } from '@tanstack/react-query';

// Fetch services
const { data: services } = useQuery({
  queryKey: ['services'],
  queryFn: () => fetch('/api/services').then(r => r.json())
});

// Create service
const createService = useMutation({
  mutationFn: (serviceData) => 
    fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serviceData)
    }).then(r => r.json())
});
```

### **WebSocket Integration**
```typescript
// Example: WebSocket integration
import { useWebSocket } from './hooks/use-websocket';

const { data: realTimeData } = useWebSocket('ws://localhost:8000/ws');
```

## Service Integration

### **Adding External MCP Services**
1. **Register Service**: Add service via API or frontend
2. **Configure OAuth** (if required): Set up OAuth credentials
3. **Test Connection**: Verify service is accessible
4. **Add to Deck**: Include service in active deck

### **Service Registration Example**
```bash
# Register an MCP service
curl -X POST http://localhost:8000/api/services \
  -H "Content-Type: application/json" \
  -d '{
    "name": "File Manager",
    "type": "mcp",
    "url": "https://file-manager.example.com/mcp",
    "description": "File management service"
  }'
```

### **OAuth Service Integration**
For services requiring OAuth:

1. **Configure OAuth Settings**:
```json
{
  "oauthClientId": "your_client_id",
  "oauthClientSecret": "your_client_secret",
  "oauthAuthorizationUrl": "https://provider.com/oauth/authorize",
  "oauthTokenUrl": "https://provider.com/oauth/token",
  "oauthRedirectUri": "http://localhost:8000/api/oauth/callback",
  "oauthScope": "read write"
}
```

2. **OAuth Flow**:
   - User initiates OAuth via frontend
   - Backend redirects to OAuth provider
   - Provider redirects back to callback URL
   - Backend exchanges code for tokens
   - Tokens stored in database

## Migration from Python Backend

### **Migration Strategy**
The TypeScript implementation maintains compatibility with the existing Python backend during migration:

1. **Parallel Operation**: Run both backends simultaneously
2. **Data Migration**: Use existing SQLite database
3. **API Compatibility**: Maintain same API endpoints
4. **Gradual Switch**: Migrate services one by one

### **API Compatibility**
| Python Endpoint | TypeScript Endpoint | Status |
|-----------------|-------------------|--------|
| `GET /api/services` | `GET /api/services` | ✅ Compatible |
| `POST /api/services` | `POST /api/services` | ✅ Compatible |
| `DELETE /api/services/:id` | `DELETE /api/services/:id` | ✅ Compatible |
| `GET /api/decks` | `GET /api/decks` | ✅ Compatible |
| `POST /api/decks` | `POST /api/decks` | ✅ Compatible |
| `GET /api/decks-active` | `GET /api/decks/active` | ⚠️ URL change |
| `POST /api/decks/:id/update` | `PUT /api/decks/:id` | ⚠️ Method change |

### **Required Changes for Migration**
1. **Update API Endpoints**: Change URLs and HTTP methods
2. **Update Response Handling**: Adapt to new response format
3. **Update Type Definitions**: Use shared package types
4. **Update WebSocket**: Connect to new WebSocket endpoint

## Integration Testing

### **API Testing**
```bash
# Test all API endpoints
curl http://localhost:8000/health
curl http://localhost:8000/api/services
curl http://localhost:8000/api/decks
curl http://localhost:8000/api/decks/active
```

### **MCP Testing**
```bash
# Test MCP server connectivity
curl http://localhost:3001/backend-status
curl http://localhost:3001/health
```

### **Frontend Testing**
```bash
# Test frontend connectivity
curl http://localhost:3000
```

### **End-to-End Testing**
1. **Service Registration**: Register a new service
2. **Deck Creation**: Create a new deck
3. **Service Addition**: Add service to deck
4. **Deck Activation**: Activate the deck
5. **MCP Access**: Access services via MCP server

## Performance Considerations

### **API Performance**
- **Response Times**: < 500ms for most operations
- **Database Queries**: Optimized with proper indexing
- **Caching**: TanStack Query provides client-side caching
- **Real-time Updates**: WebSocket for live updates

### **MCP Performance**
- **Tool Discovery**: Cached tool lists
- **Service Calls**: Direct routing to services
- **Error Handling**: Graceful fallbacks
- **Connection Management**: Proper session handling

### **Frontend Performance**
- **Bundle Size**: Optimized with Vite
- **Hot Reload**: Fast development experience
- **State Management**: Efficient updates with TanStack Query
- **Real-time**: WebSocket for live updates

## Security Considerations

### **API Security**
- **Input Validation**: Zod schemas for all inputs
- **Error Handling**: No sensitive data in error messages
- **CORS**: Configured for development and production
- **Rate Limiting**: Implemented for API endpoints

### **OAuth Security**
- **Token Storage**: Secure token storage in database
- **Token Refresh**: Automatic token refresh
- **State Validation**: OAuth state parameter validation
- **Redirect URIs**: Strict redirect URI validation

## OAuth 2.0 Implementation Details

### **OAuth Flow Architecture**
The OAuth implementation follows OAuth 2.0 best practices with the following flow:

1. **Discovery**: Automatic OAuth requirement detection via MCP server analysis
2. **Auto-Registration**: Dynamic OAuth application registration with MCP services
3. **Authorization**: Secure authorization flow with state parameter validation
4. **Token Exchange**: Backend handles token exchange to keep credentials secure
5. **Token Management**: Automatic token storage, expiration detection, and refresh
6. **Status Detection**: Real-time OAuth status monitoring with UI updates

### **Key Features**
- **Auto-Discovery**: Automatically detects OAuth requirements from MCP services
- **Dynamic Registration**: Performs OAuth client registration with MCP services
- **Secure Flow**: Backend handles all OAuth operations, frontend never sees tokens
- **Token Management**: Automatic token storage, expiration detection, and refresh
- **Status Monitoring**: Real-time OAuth status with proper UI feedback
- **Error Handling**: Comprehensive error handling with user-friendly messages

### **OAuth Status States**
- **`not_required`**: Service doesn't require OAuth authentication
- **`required`**: OAuth is required but not authenticated
- **`authenticated`**: Valid OAuth tokens present and not expired
- **`expired`**: OAuth tokens exist but are expired

### **Security Considerations**
- **Redirect URI Validation**: Ensures OAuth callbacks go to correct endpoints
- **State Parameter**: Prevents CSRF attacks with cryptographically secure state
- **Token Storage**: OAuth tokens stored securely in database with proper headers
- **Expiration Handling**: Automatic detection of token expiration with 5-minute buffer

### **MCP Security**
- **Session Management**: Proper MCP session handling
- **Tool Validation**: Validate tool calls before execution
- **Error Boundaries**: Graceful error handling
- **Access Control**: Service-level access control

## Troubleshooting Integration Issues

### **Common Issues**

#### **1. MCP Connection Issues**
```bash
# Check MCP server status
curl http://localhost:3001/backend-status

# Check backend connectivity
curl http://localhost:8000/health

# Verify ports are available
lsof -i :3001
lsof -i :8000
```

#### **2. API Connection Issues**
```bash
# Check API server
curl http://localhost:8000/health

# Check CORS configuration
curl -H "Origin: http://localhost:3000" http://localhost:8000/api/services
```

#### **3. WebSocket Issues**
```javascript
// Check WebSocket connection
const ws = new WebSocket('ws://localhost:8000/ws');
ws.onopen = () => console.log('Connected');
ws.onerror = (error) => console.error('WebSocket error:', error);
```

#### **4. OAuth Issues**
- Verify OAuth credentials are correct
- Check redirect URIs match exactly
- Ensure OAuth provider is accessible
- Check token storage and refresh

### **Debugging Steps**
1. **Check Logs**: All services log to `logs/` directory
2. **Verify Network**: Ensure all ports are accessible
3. **Test Endpoints**: Use curl to test individual endpoints
4. **Check Configuration**: Verify environment variables
5. **Monitor Traffic**: Use browser dev tools for frontend issues

## Best Practices

### **API Integration**
- Use proper error handling
- Implement retry logic for failed requests
- Cache responses when appropriate
- Use WebSocket for real-time updates

### **MCP Integration**
- Handle connection errors gracefully
- Implement proper session management
- Cache tool lists for performance
- Validate tool calls before execution

### **Frontend Integration**
- Use TanStack Query for data fetching
- Implement proper loading states
- Handle WebSocket disconnections
- Provide user feedback for actions

### **Service Integration**
- Test service connectivity before registration
- Implement proper OAuth flows
- Handle service failures gracefully
- Monitor service health

## Next Steps

### **Immediate Actions**
1. **Test Integration**: Verify all integration points work
2. **Performance Testing**: Test with multiple services
3. **Error Handling**: Test error scenarios
4. **Documentation**: Update integration documentation

### **Future Enhancements**
1. **Authentication**: Add user authentication
2. **Service Templates**: Pre-configured service templates
3. **Advanced MCP Features**: More MCP tools and resources
4. **Performance Optimization**: Further performance improvements
5. **Security Enhancements**: Additional security measures

This integration guide provides comprehensive information for integrating Agent Deck with external systems and migrating from existing implementations. The system is designed to be flexible and extensible while maintaining compatibility and performance.
