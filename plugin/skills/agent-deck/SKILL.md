---
name: agent-deck
description: >-
  Use Agent Deck to view and switch MCP context decks, inspect active services,
  and open the full dashboard. Use when the user asks about Agent Deck, MCP
  decks, active context, switching decks, or managing many MCP servers.
---

# Agent Deck

Agent Deck is a **local** context-aware MCP proxy. One MCP endpoint (`http://127.0.0.1:3001/mcp`) exposes only the tools from the user's **active deck**.

## Prerequisites

Agent Deck must be running locally:

```bash
git clone https://github.com/not-so-fat/agent_deck.git
cd agent_deck
npm install && npm run build
npm run dev:all
```

Services:
- Dashboard: `http://localhost:3000` (register MCPs, OAuth, deck builder)
- MCP server: `http://127.0.0.1:3001/mcp`

## MCP App (Cursor 2.6+)

If the host supports MCP Apps, call **`show_agent_deck`** to render an in-chat control panel:
- Active deck and connected services
- Switch decks (`activate_deck`)
- Link to full dashboard

Example prompts:
- "Show my Agent Deck"
- "What MCP context am I using?"
- "Switch to my Coding deck"

## Text tools (all hosts)

| Tool | Purpose |
|------|---------|
| `show_agent_deck` | MCP App UI + deck overview |
| `get_decks` | List all decks |
| `get_active_deck` | Active deck with services |
| `list_active_deck_services` | Services in active deck |
| `list_service_tools` | Tools for a service (`serviceId`) |
| `call_service_tool` | Call a proxied tool |
| `activate_deck` | Switch active deck (`deckId`) |

## Workflow

1. User manages MCP servers and decks in the dashboard (`localhost:3000`)
2. User activates one deck for the current task
3. Agent uses Agent Deck MCP tools to call only services in that deck

## When deck setup is needed

Direct the user to `http://localhost:3000` for:
- Registering remote or local MCP servers
- OAuth configuration
- Drag-and-drop deck building

Do not try to replicate full setup inside chat — use the dashboard.
