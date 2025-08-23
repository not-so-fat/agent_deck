# Agent Deck MCP Server - Technical Guide

## Overview

The Agent Deck MCP Server provides a unified interface to access tools, resources, and prompts from all services in the active deck. It acts as a proxy/router that automatically discovers and routes requests to the appropriate services.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MCP Client    │◄──►│  Agent Deck MCP  │◄──►│  Active Deck    │
│                 │    │     Server       │    │   Services      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Database       │
                       │ (SQLite)         │
                       └──────────────────┘
```

## Core Components

### **1. MCPDatabaseManager**
- **Purpose**: Database access for reading active deck and services
- **Location**: `src/database.ts`
- **Key Methods**:
  - `getActiveDeck()`: Retrieves the currently active deck
  - `getDeckServices()`: Gets all services in a deck
  - `close()`: Closes database connection

### **2. MCPClientManager**
- **Purpose**: HTTP client for communicating with external MCP services
- **Location**: `src/mcp-client.ts`
- **Key Methods**:
  - `discoverTools(serviceUrl)`: Discovers tools from a service
  - `callTool(serviceUrl, toolName, arguments)`: Calls a tool
  - `discoverResources(serviceUrl)`: Discovers resources
  - `getResource(serviceUrl, resourceName)`: Gets a resource
  - `listPrompts(serviceUrl)`: Lists prompts
  - `getPrompt(serviceUrl, promptName)`: Gets a prompt

### **3. AgentDeckMCPServer**
- **Purpose**: Main MCP server implementation
- **Location**: `src/server.ts`
- **Key Features**:
  - Tool discovery and calling
  - Resource discovery and access
  - Prompt management
  - Error handling and logging

## Protocol Implementation

### **Server Initialization**
```typescript
const server = new Server({
  name: 'agent-deck-mcp-server',
  version: '1.0.0',
});
```

### **Capabilities**
The server declares support for:
- **Tools**: Tool discovery and calling
- **Resources**: Resource discovery and access
- **Prompts**: Prompt listing and retrieval

## Request Handling

### **Tool Discovery**
```typescript
// List tools from all services in active deck
this.server.setRequestHandler(ListToolsRequestSchema, async () => {
  const activeDeck = await this.dbManager.getActiveDeck();
  if (!activeDeck) return { tools: [] };

  const allTools: any[] = [];
  
  for (const service of activeDeck.services) {
    if (service.type === 'mcp') {
      const tools = await this.mcpClient.discoverTools(service.url);
      allTools.push(...tools.map(tool => ({
        ...tool,
        name: `${service.name}:${tool.name}`,
        description: `[${service.name}] ${tool.description}`,
      })));
    }
  }

  return { tools: allTools };
});
```

### **Tool Calling**
```typescript
// Call tool from specific service
this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  // Parse "serviceName:toolName" format
  const [serviceName, toolName] = name.split(':');
  
  const activeDeck = await this.dbManager.getActiveDeck();
  const service = activeDeck.services.find(s => s.name === serviceName);
  
  const result = await this.mcpClient.callTool(service.url, toolName, args);
  
  return {
    content: result.content || [{ type: 'text', text: JSON.stringify(result) }],
  };
});
```

## Naming Convention

The server uses a naming convention to distinguish between services:

### **Tools**
- **Format**: `serviceName:toolName`
- **Example**: `fileManager:readFile`
- **Description**: `[fileManager] Read a file from the filesystem`

### **Resources**
- **Format**: `serviceName:resourceUri`
- **Example**: `fileManager:file:///path/to/file`
- **Description**: Access resources from specific services

### **Prompts**
- **Format**: `serviceName:promptName`
- **Example**: `codeAssistant:refactorCode`
- **Description**: Retrieve prompts from specific services

## Error Handling

### **Service Not Found**
```typescript
if (!service) {
  throw new Error(`Service "${serviceName}" not found in active deck`);
}
```

### **Unsupported Service Type**
```typescript
if (service.type !== 'mcp') {
  throw new Error(`Service "${serviceName}" is not an MCP service`);
}
```

### **Service Communication Errors**
```typescript
try {
  const tools = await this.mcpClient.discoverTools(service.url);
  // Process tools
} catch (error) {
  console.error(`Failed to discover tools for service ${service.name}:`, error);
  // Continue with other services
}
```

## Database Schema

### **Required Tables**
The MCP server expects these tables to exist:

```sql
-- Services table
CREATE TABLE services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  -- ... other fields
);

-- Decks table
CREATE TABLE decks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active INTEGER DEFAULT 0,
  -- ... other fields
);

-- Deck services table
CREATE TABLE deck_services (
  deck_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (deck_id, service_id)
);
```

## Usage Examples

### **Starting the Server**
```bash
cd packages/mcp-server
npm run build
node dist/index.js
```

### **Client Integration**
```typescript
// Example: Using with MCP client
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client({
  name: 'my-client',
  version: '1.0.0',
});

const transport = new StdioClientTransport();
await client.connect(transport);

// List all tools from active deck
const tools = await client.listTools();
console.log('Available tools:', tools.tools);

// Call a tool
const result = await client.callTool({
  name: 'fileManager:readFile',
  arguments: { path: '/path/to/file' }
});
console.log('Tool result:', result);
```

## Configuration

### **Environment Variables**
- `DB_PATH`: Path to SQLite database (default: `./agent-deck.db`)

### **Database Path**
```typescript
// Default database path
const dbPath = process.env.DB_PATH || './agent-deck.db';
const dbManager = new MCPDatabaseManager(dbPath);
```

## Performance Considerations

### **Caching**
- Consider implementing caching for service discovery results
- Cache active deck information to reduce database queries
- Implement connection pooling for external service calls

### **Error Recovery**
- Implement retry logic for failed service calls
- Add circuit breaker pattern for unreliable services
- Graceful degradation when services are unavailable

### **Monitoring**
- Add metrics for request latency
- Monitor service availability
- Track error rates per service

## Security Considerations

### **Service Validation**
- Validate service URLs before making requests
- Implement rate limiting for external service calls
- Add authentication for sensitive operations

### **Input Validation**
- Validate tool names and arguments
- Sanitize service names to prevent injection
- Implement proper error handling to avoid information leakage

## Testing

### **Unit Tests**
```bash
npm test
```

### **Integration Tests**
- Test with real MCP services
- Test database integration
- Test error scenarios

### **Load Testing**
- Test with multiple concurrent clients
- Test with large numbers of services
- Test performance under load

## Troubleshooting

### **Common Issues**

#### **No Active Deck**
```
Error: No active deck found
```
**Solution**: Ensure there's an active deck in the database.

#### **Service Not Found**
```
Error: Service "serviceName" not found in active deck
```
**Solution**: Check that the service exists and is in the active deck.

#### **Service Communication Error**
```
Error: Failed to discover tools for service serviceName
```
**Solution**: Check service URL and network connectivity.

### **Debug Mode**
Enable debug logging:
```typescript
// Add to server.ts
console.log('Debug: Active deck:', activeDeck);
console.log('Debug: Service:', service);
console.log('Debug: Tool result:', result);
```

## Future Enhancements

### **Planned Features**
- **Service Templates**: Pre-configured service templates
- **Advanced Routing**: Route based on tool capabilities
- **Load Balancing**: Distribute requests across multiple instances
- **Service Discovery**: Automatic service discovery
- **Metrics Dashboard**: Real-time performance metrics

### **Performance Improvements**
- **Connection Pooling**: Reuse connections to external services
- **Response Caching**: Cache frequently requested data
- **Parallel Processing**: Process multiple requests concurrently
- **Compression**: Compress responses for better performance

## Contributing

### **Development Setup**
```bash
cd packages/mcp-server
npm install
npm run dev
```

### **Code Style**
- Follow TypeScript best practices
- Use meaningful variable names
- Add comprehensive error handling
- Write unit tests for new features

### **Testing**
- Write tests for all new functionality
- Ensure existing tests pass
- Add integration tests for complex scenarios
