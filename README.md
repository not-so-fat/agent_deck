# <img src="./misc/AgentDeckLogo2.png" height="30px"> Agent Deck

[![MCP](https://img.shields.io/badge/MCP-compatible-blue)](https://modelcontextprotocol.io)
[![MCP Apps](https://img.shields.io/badge/MCP%20Apps-experimental-purple)](docs/MCP_APP.md)
[![Cursor](https://img.shields.io/badge/Cursor-plugin%20ready-black)](docs/CURSOR_PLUGIN.md)
[![License: ISC](https://img.shields.io/badge/License-ISC-green.svg)](LICENSE)

<img src="./misc/Demo.gif" alt="Demo" width="70%" />

[![Watch on YouTube](https://img.shields.io/badge/YouTube-Watch%20Demo-red?logo=youtube&logoColor=white)](https://www.youtube.com/watch?v=TeLXBKkWkFA)

**One MCP endpoint. Many servers. Switch context with decks.**

[Quick Start](#quick-start) · [MCP App in Cursor](#mcp-app-in-cursor) · [Cursor Plugin](#cursor-plugin) · [Docs](#documentation)


## Problem: Too Many MCPs on My Agent

<img src="./misc/CursorTooManyTools.png" alt="Cursor Too Many Tools" width="30%" />

People use agent apps like Cursor for many purposes and eventually connect **many MCP servers**. The agent slows down and becomes less accurate with too many tools loaded at once.

When coding, documenting, or trying new MCP services, you don't need every server connected — only the ones that fit the current context.


## Idea: Local MCP Proxy with Decks

<img src="./misc/Idea.png" alt="Frontend" width="70%" />

Agent Deck is a **local context-aware MCP proxy**. Connect one endpoint (`http://127.0.0.1:3001/mcp`) to your agent. It exposes only the MCP servers in the **deck bound to your workspace** (via `.agent-deck/deck.yaml`). See [MVP spec](docs/MVP.md) for the full Modules 1–3 behavior.


## Features

### Dashboard (`localhost:3000`)

<img src="./misc/UI.png" alt="Frontend" width="70%" />

- Register remote and local MCP servers (with OAuth support) and **API keys** (Keychain-backed)
- Create **decks** — named contexts (Coding, Docs, Research, …)
- Drag-and-drop MCP and API key cards from **My Collection** into a deck
- Copy `.agent-deck/deck.yaml` from the deck sidebar into each repo; agents **bind** via `bind_workspace`
- View **playbooks** (markdown procedures) in the dashboard Playbooks panel

### MCP Server (`localhost:3001/mcp`)

| Tool | Purpose |
|------|---------|
| `show_agent_deck` | **MCP App** — in-chat deck panel (Cursor 2.6+) |
| `bind_workspace` | Bind session to repo via `.agent-deck/deck.yaml` |
| `get_bound_deck` | Bound deck + services |
| `list_bound_deck_services` | MCP services on bound deck |
| `list_bound_deck_credentials` | API key metadata on bound deck (no secrets) |
| `list_playbooks` / `get_playbook` | Read playbook cards on the bound deck |
| `register_playbook` / `update_playbook` | Create or update playbook cards with auto-detected dependencies |
| `list_service_tools` / `call_service_tool` | Proxy to a service on the bound deck |

Legacy aliases (`get_active_deck`, `activate_deck`, …) remain for v1 compatibility — prefer the tools above. Details: [MVP spec](docs/MVP.md).

### MCP App in Cursor

Hosts with [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview) support (e.g. **Cursor 2.6+**) can render an interactive control panel in chat:

1. Run Agent Deck (`npm run dev:all`)
2. Connect MCP: `http://127.0.0.1:3001/mcp`
3. Ask: **"Show my Agent Deck"**

The app shows your active deck, connected services, deck switching, and a link to the full dashboard. See [MCP App guide](docs/MCP_APP.md).

### Cursor Plugin

Install via the [Cursor plugin](plugin/) or add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "agent-deck": { "url": "http://127.0.0.1:3001/mcp" }
  }
}
```

Includes a skill so the agent knows how to use decks and the MCP App. See [Cursor plugin guide](docs/CURSOR_PLUGIN.md).


## Quick Start

### Prerequisites

- **Node.js 20.x LTS**
- npm or yarn

```bash
# nvm
nvm install 20 && nvm use 20

# Homebrew (macOS arm64)
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
```

### Install & run

```bash
git clone https://github.com/not-so-fat/agent_deck.git
cd agent_deck
npm install
npm run build
npm run dev:all
```

This starts:
- Dashboard → `http://localhost:3000`
- Backend API → `http://localhost:8000`
- MCP server → `http://127.0.0.1:3001/mcp`

### Connect your agent

1. **Set up decks** at `http://localhost:3000` — register MCPs/API keys, build a deck, copy `deck.yaml` into your repo
2. **Add MCP** in Cursor (Settings → Tools & MCP) or use [`.cursor/mcp.json`](.cursor/mcp.json)
3. **Bind workspace** — agent calls `bind_workspace` with your repo root (or set `AGENT_DECK_WORKSPACE`)
4. **Try the MCP App** — ask *"Show my Agent Deck"*


## Documentation

| Guide | Description |
|-------|-------------|
| [Setup](docs/SETUP.md) | Installation and configuration |
| [User Guide](docs/USER_GUIDE.md) | Decks, services, OAuth |
| [MCP App](docs/MCP_APP.md) | In-chat UI (experimental) |
| [Cursor Plugin](docs/CURSOR_PLUGIN.md) | Marketplace plugin & skill |
| [MCP Registry](docs/MCP_REGISTRY.md) | Publish to official registry |
| [Architecture](docs/ARCHITECTURE.md) | Technical design |
| [MVP](docs/MVP.md) | **Source of truth** — vault, playbooks, repo deck (Modules 1–3, as-built) |
| [Playbooks vs Skills](docs/PLAYBOOKS_AND_SKILLS.md) | When to use playbook cards vs Cursor skills |
| [Monorepo scope](docs/MONOREPO_SCOPE.md) | Where to put `deck.yaml` in monorepos |
| [Integration](docs/INTEGRATION.md) | MCP client integration |

## Discoverability

Agent Deck can be listed on:

| Channel | Status | Notes |
|---------|--------|-------|
| **GitHub** | Ready | Public repo, README, demo GIF |
| **Cursor Marketplace** | Plugin ready | Submit [`plugin/`](plugin/) |
| **MCP Registry** | Metadata ready | [`server.json`](server.json) — needs npm publish |
| **Claude Directory** | Future | Desktop extension (MCPB) path |
| **ChatGPT Apps** | Future | Requires hosted remote MCP |

## Future Plan

- Simpler install (`npx agent-deck`)
- MCP Registry npm package publish
- Passthrough for downstream MCP Apps
- Usage analytics and smarter deck recommendations
