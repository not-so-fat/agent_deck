# Agent Deck MCP Server - TypeScript (HTTP Transport)

This project now provides an MCP server implemented in TypeScript and embedded inside the backend package. It uses the official `@modelcontextprotocol/sdk` with the HTTP transport to expose tools that interact with the Agent Deck backend API.

## Key Points

- Official MCP SDK (`@modelcontextprotocol/sdk`)
- HTTP transport via `StreamableHTTPServerTransport`
- Lives in `packages/backend/src/mcp-server.ts` and `packages/backend/src/mcp-index.ts`
- Unified access to services in the active deck; tool discovery and tool calls are routed through the backend API

## Files

- `packages/backend/src/mcp-server.ts`: MCP server definitions (tools, resources, routes)
- `packages/backend/src/mcp-index.ts`: Entrypoint to start the MCP server

## How to Run

```bash
cd packages/backend
npm run mcp
# MCP server available at http://localhost:3001
# MCP endpoint: POST http://localhost:3001/mcp (requires an MCP client session)
```

## Tools (partial)

- `get_services`: List all services
- `get_decks`: List all decks
- `get_active_deck`: Get the currently active deck
- `list_active_deck_services`: List services in the active deck
- `list_service_tools(serviceId)`: Discover tools for a specific service
- `call_service_tool(serviceId, toolName, arguments?)`: Call a tool on a registered service

`call_service_tool` posts to the backend at `/api/services/:id/call` with body `{ toolName, arguments }`.
`arguments` may be an object or a JSON string; strings are parsed to JSON.

## HTTP Transport Notes

The HTTP transport requires a valid MCP session. Use an MCP client (Cursor, `use-mcp`, or the official SDK client) to establish a session and call tools. Simple `curl` calls to `/mcp` without session headers will be rejected.

## Optional: Python Reference

The repository contains a Python MCP server (`app_mcp.py`) as a reference implementation that calls the backend API. The TypeScript MCP server is the primary supported server.

## Troubleshooting

1. Ensure backend API is running on port 8000
2. Start MCP server via `npm run mcp` in `packages/backend`
3. Use an MCP client to open a session before calling tools
4. Check logs: `logs/mcp_ts.log`

