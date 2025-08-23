# Agent Deck MCP Server - Python Implementation

This is a revised Python MCP server that integrates with the new TypeScript backend APIs instead of using direct database access.

## Key Changes from Old Implementation

### 1. **API Integration Instead of Direct Database Access**
- **Old**: Direct SQLite database access via `DatabaseManager`
- **New**: HTTP API calls to the TypeScript backend at `http://localhost:8000`

### 2. **Response Format Handling**
- **Old**: Direct database results
- **New**: Handles `ApiResponse<T>` format with `success` and `data`/`error` fields

### 3. **Field Name Updates**
- **Old**: `api_key` field
- **New**: `apiKey` field (camelCase to match TypeScript conventions)

### 4. **Service Discovery**
- **Old**: Direct MCP client manager calls
- **New**: Uses backend API endpoint `/api/services/{id}/tools`

## Architecture

```
┌─────────────────┐    HTTP API    ┌──────────────────┐
│   Python MCP    │ ──────────────► │ TypeScript       │
│   Server        │                │ Backend          │
│   (Port 3001)   │                │ (Port 8000)      │
└─────────────────┘                └──────────────────┘
         │                                   │
         │ MCP Protocol                      │ Database
         ▼                                   ▼
┌─────────────────┐                ┌──────────────────┐
│   MCP Clients   │                │   SQLite DB      │
│   (Cursor, etc) │                │                  │
└─────────────────┘                └──────────────────┘
```

## Setup

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Start the TypeScript Backend
```bash
cd packages/backend
npm run dev
```

### 3. Start the Python MCP Server
```bash
python app_mcp.py
```

## Available MCP Tools

### 1. `get_active_deck_info()`
Returns information about the currently active deck and its services.

### 2. `list_active_deck_services()`
Lists all services in the currently active deck.

### 3. `list_service_tools(service_id: str)`
Lists all available tools for a specific service in the active deck.

### 4. `call_service(service_id: str, tool_name: str, arguments: str)`
Calls a tool on a service from the currently active deck.

## API Endpoints Used

The Python MCP server communicates with these TypeScript backend endpoints:

- `GET /api/decks/active` - Get the currently active deck
- `GET /api/services` - Get all services
- `GET /api/services/{id}` - Get a specific service
- `GET /api/services/{id}/tools` - Get tools for a service
- `POST /api/services/{id}/call` - Call a tool on a service

## Configuration

### Backend URL
The server connects to the TypeScript backend at `http://localhost:8000` by default. You can modify this by changing the `BACKEND_BASE_URL` constant in `app_mcp.py`.

### Port
The MCP server runs on port 3001 by default. You can change this in the `app.run()` call at the bottom of the file.

## Error Handling

The server includes comprehensive error handling for:
- Network connectivity issues
- API response format errors
- Service discovery failures
- Tool execution errors

## Logging

The server uses Python's logging module with INFO level by default. You can adjust the log level by modifying the `logging.basicConfig()` call.

## Integration with Cursor

To use this MCP server with Cursor:

1. Add the following to your Cursor settings:
```json
{
  "mcpServers": {
    "agent-deck": {
      "command": "python",
      "args": ["app_mcp.py"],
      "env": {}
    }
  }
}
```

2. Or use the HTTP transport by connecting to `http://localhost:3001/mcp`

## Troubleshooting

### Common Issues

1. **Backend not running**: Ensure the TypeScript backend is running on port 8000
2. **Port conflicts**: Change the port in `app_mcp.py` if 3001 is in use
3. **API errors**: Check the backend logs for detailed error messages
4. **Dependencies**: Ensure all Python dependencies are installed

### Debug Mode

To enable debug logging, modify the logging configuration:
```python
logging.basicConfig(level=logging.DEBUG)
```

## Future Improvements

1. **MCP Client Integration**: Use the TypeScript backend's MCP client manager for better MCP service integration
2. **Caching**: Add caching for frequently accessed data
3. **Health Checks**: Add health check endpoints
4. **Metrics**: Add performance metrics and monitoring
5. **Configuration**: Move configuration to environment variables or config files

