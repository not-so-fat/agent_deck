# Open Issue: Python MCP Server Integration with TypeScript Backend

## Issue Description

We need to test and validate the new Python MCP server that integrates with our TypeScript backend APIs instead of using direct database access. This is a critical component for providing MCP protocol access to our Agent Deck services.

## Background

The old Python MCP server (`old_impl/app_mcp.py`) used direct SQLite database access via `DatabaseManager`. With our new TypeScript backend architecture, we need to update the Python MCP server to use HTTP API calls instead.

## Key Changes Made

### 1. **API Integration Instead of Direct Database Access**
- **Old**: Direct SQLite database access via `DatabaseManager`
- **New**: HTTP API calls to TypeScript backend at `http://localhost:8000`

### 2. **Response Format Handling**
- **Old**: Direct database results
- **New**: Handles `ApiResponse<T>` format with `success` and `data`/`error` fields

### 3. **Field Name Updates**
- **Old**: `api_key` field
- **New**: `apiKey` field (camelCase to match TypeScript conventions)

### 4. **Service Discovery**
- **Old**: Direct MCP client manager calls
- **New**: Uses backend API endpoint `/api/services/{id}/tools`

## Files Created/Modified

- `app_mcp.py` - New Python MCP server with API integration
- `requirements.txt` - Python dependencies
- `MCP_SERVER_README.md` - Documentation

## Testing Requirements

### Prerequisites
- TypeScript backend running on port 8000
- Python 3.8+ with virtualenv support
- At least one deck with services configured

### Test Scenarios

1. **Basic Connectivity**
   - [ ] Python MCP server starts without errors
   - [ ] Can connect to TypeScript backend API
   - [ ] MCP endpoint responds correctly

2. **Tool Discovery**
   - [ ] `get_active_deck_info()` returns correct deck information
   - [ ] `list_active_deck_services()` lists services in active deck
   - [ ] `list_service_tools(service_id)` discovers tools from MCP services

3. **Tool Execution**
   - [ ] `call_service()` can execute tools on MCP services
   - [ ] `call_service()` can execute tools on A2A services
   - [ ] Error handling works for invalid service calls

4. **Integration with Cursor**
   - [ ] Cursor can connect to MCP server
   - [ ] Tools are discoverable in Cursor
   - [ ] Tool execution works from Cursor

## Setup Instructions

### 1. Create and Activate Virtual Environment

```bash
# Navigate to project root
cd /Users/yusukemuraoka/workspace/codes/agent_deck

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Verify activation
which python
# Should show: /Users/yusukemuraoka/workspace/codes/agent_deck/venv/bin/python
```

### 2. Install Dependencies

```bash
# Install Python dependencies
pip install -r requirements.txt

# Verify installation
pip list | grep -E "(fastmcp|requests)"
```

### 3. Start TypeScript Backend

```bash
# In a new terminal (keep virtualenv active)
cd packages/backend
npm run dev

# Verify backend is running
curl http://localhost:8000/api/health
```

### 4. Start Python MCP Server

```bash
# In another terminal (keep virtualenv active)
cd /Users/yusukemuraoka/workspace/codes/agent_deck

# Start the MCP server
python app_mcp.py
```

Expected output:
```
🚀 Starting AgentDeck Active Deck MCP Service (HTTP)...
📡 Available MCP tools:
   - call_service(service_id, tool_name, arguments)
   - get_active_deck_info()
   - list_active_deck_services()
   - list_service_tools(service_id)

📋 Note: This MCP service only provides access to the currently active deck's services.
🎛️  Deck management should be done through the web UI.
🌐 MCP service will be available at: http://localhost:3001/mcp
🔗 Backend API: http://localhost:8000
```

### 5. Test MCP Server

```bash
# Test health endpoint
curl http://localhost:3001/health

# Test MCP endpoint (should return 200 OK)
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {"tools": {}}, "clientInfo": {"name": "test-client", "version": "1.0.0"}}}'
```

### 6. Test with Cursor

1. Open Cursor
2. Go to Settings → Extensions → MCP
3. Add new MCP server:
   ```json
   {
     "name": "agent-deck",
     "command": "python",
     "args": ["/Users/yusukemuraoka/workspace/codes/agent_deck/app_mcp.py"],
     "env": {
       "VIRTUAL_ENV": "/Users/yusukemuraoka/workspace/codes/agent_deck/venv"
     }
   }
   ```
4. Restart Cursor
5. Check if tools are available in the MCP panel

## Troubleshooting

### Common Issues

1. **Virtual Environment Not Activated**
   ```bash
   # Check if virtualenv is active
   echo $VIRTUAL_ENV
   # Should show: /Users/yusukemuraoka/workspace/codes/agent_deck/venv
   ```

2. **Backend Not Running**
   ```bash
   # Check if backend is running
   curl http://localhost:8000/api/health
   # Should return JSON response
   ```

3. **Port Conflicts**
   ```bash
   # Check what's using port 3001
   lsof -i :3001
   # Kill process if needed
   kill -9 <PID>
   ```

4. **Python Dependencies Missing**
   ```bash
   # Reinstall dependencies
   pip install -r requirements.txt --force-reinstall
   ```

### Debug Mode

To enable debug logging, modify `app_mcp.py`:
```python
logging.basicConfig(level=logging.DEBUG)
```

## Success Criteria

- [ ] Python MCP server starts without errors
- [ ] Can connect to TypeScript backend API
- [ ] All MCP tools are discoverable
- [ ] Tool execution works for both MCP and A2A services
- [ ] Cursor can connect and use the tools
- [ ] Error handling works correctly
- [ ] No memory leaks or performance issues

## Next Steps After Testing

1. **Performance Optimization**: Add caching for frequently accessed data
2. **Error Handling**: Improve error messages and recovery
3. **Monitoring**: Add health checks and metrics
4. **Configuration**: Move settings to environment variables
5. **Documentation**: Update main project documentation

## Files to Review

- `app_mcp.py` - Main MCP server implementation
- `requirements.txt` - Python dependencies
- `MCP_SERVER_README.md` - Detailed documentation
- `packages/backend/src/routes/` - Backend API endpoints
- `packages/shared/src/types/` - Type definitions

## Assignee

@yusukemuraoka

## Priority

High - This is critical for MCP protocol support

## Labels

- `mcp-server`
- `python`
- `integration`
- `testing`
- `virtualenv`

