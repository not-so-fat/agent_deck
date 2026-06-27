# MCP App (experimental)

Agent Deck exposes an optional **MCP App** UI inside MCP hosts that support the
[`io.modelcontextprotocol/ui`](https://modelcontextprotocol.io/extensions/apps/overview)
extension (for example Cursor 2.6+).

## What it does

- Tool: `show_agent_deck` — renders an in-chat control panel
- Shows the active deck and connected services
- Lets you switch decks with `activate_deck`
- Links to the full dashboard at `http://localhost:3000`

The standalone web UI at `:3000` is unchanged. Use it for service registration,
OAuth, local MCP setup, and drag-and-drop deck building.

## Build

The MCP App bundle is built into `packages/mcp-app/dist/mcp-app.html`.

```bash
npm run build --workspace @agent-deck/mcp-app
```

`npm run dev:all` builds the bundle automatically before starting the MCP server.

## Try in Cursor

1. Run Agent Deck: `npm run dev:all`
2. Connect MCP: `http://127.0.0.1:3001/mcp`
3. Ask the agent: **"Show my Agent Deck"** or call `show_agent_deck`

## Configuration

- `AGENT_DECK_DASHBOARD_URL` — dashboard link shown in the MCP App (default: `http://localhost:3000`)

## Local testing without Cursor

Use the [ext-apps basic-host](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/basic-host):

```bash
SERVERS='["http://localhost:3001/mcp"]' npm start
```
