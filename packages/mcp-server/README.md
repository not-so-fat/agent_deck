# Agent Deck MCP Server

This is the Model Context Protocol (MCP) server for Agent Deck. It provides a unified interface to access tools, resources, and prompts from all services in the active deck.

## Features

- **Unified Tool Access**: Access tools from all MCP services in the active deck through a single interface
- **Resource Discovery**: Discover and access resources from deck services
- **Prompt Management**: List and retrieve prompts from deck services
- **Database Integration**: Automatically reads the active deck from the Agent Deck database
- **Error Handling**: Graceful error handling for service failures

## Installation

```bash
npm install
```

## Development

```bash
# Build the package
npm run build

# Run in development mode
npm run dev

# Run tests
npm test
```

## Usage

### As a Standalone MCP Server

The MCP server can be run as a standalone process that communicates via stdio:

```bash
# Build first
npm run build

# Run the server
node dist/index.js
```

### Integration with MCP Clients

The server can be integrated with any MCP-compatible client. The server name is `agent-deck-mcp-server` and version is `1.0.0`.

## API

### Tools

#### List Tools
Lists all available tools from services in the active deck.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "serviceName:toolName",
        "description": "[serviceName] tool description",
        "inputSchema": { ... }
      }
    ]
  }
}
```

#### Call Tool
Calls a specific tool from a service in the active deck.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "serviceName:toolName",
    "arguments": { ... }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Tool result"
      }
    ]
  }
}
```

### Resources

#### List Resources
Lists all available resources from services in the active deck.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "resources/list"
}
```

#### Read Resource
Reads a specific resource from a service in the active deck.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "resources/read",
  "params": {
    "uri": "serviceName:resourceUri"
  }
}
```

### Prompts

#### List Prompts
Lists all available prompts from services in the active deck.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "prompts/list"
}
```

#### Get Prompt
Retrieves a specific prompt from a service in the active deck.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "prompts/get",
  "params": {
    "name": "serviceName:promptName"
  }
}
```

## Naming Convention

The server uses a naming convention to distinguish between services:

- **Tools**: `serviceName:toolName`
- **Resources**: `serviceName:resourceUri`
- **Prompts**: `serviceName:promptName`

This allows the server to route requests to the correct service and tool/resource/prompt.

## Error Handling

The server handles various error scenarios:

- **No Active Deck**: Returns empty lists or appropriate error messages
- **Service Not Found**: Returns error when trying to access non-existent services
- **Service Communication Errors**: Logs errors and continues with other services
- **Invalid Tool Names**: Returns error for malformed tool names

## Database Requirements

The MCP server expects the Agent Deck database to be available and contain:

1. A `decks` table with an active deck
2. A `services` table with MCP services
3. A `deck_services` table linking services to decks

The server automatically reads the active deck and its services on startup.

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

## Development Notes

- The server uses the `@modelcontextprotocol/sdk` package for MCP protocol implementation
- Database access is handled through `better-sqlite3`
- HTTP requests to services are made using the native `fetch` API
- Error handling is comprehensive to ensure the server remains stable
