# Agent Deck

[![MCP](https://img.shields.io/badge/MCP-compatible-blue)](https://modelcontextprotocol.io)
[![License: ISC](https://img.shields.io/badge/License-ISC-green.svg)](LICENSE)

**Switch what your agent knows — decks of tools, keys, and self-improving playbooks.**

[Quick Start](#quick-start) · [Reference](#reference) · [Docs](#documentation)

## Quick Start

> **⚠️ macOS required.** API key secrets, OAuth client secrets, and OAuth tokens are stored in **macOS Keychain**. Linux and Windows are not supported for production use yet ([dev file fallback only](docs/SETUP.md#secrets--oauth-storage)).

**Requirements:** Node.js 20+ · npm · Dashboard `http://127.0.0.1:1111` · Agent Deck MCP `http://127.0.0.1:1110/mcp`

### 1. Install and launch

```bash
npm install -g @agent-deck/cli
agent-deck start
```

Open `http://127.0.0.1:1111`. Day to day: `agent-deck start` / `agent-deck stop` · `agent-deck status` if something fails.

### 2. Register Agent Deck in your agent

Your host must know **`http://127.0.0.1:1110/mcp`** — not Linear, Notion, or other services. Without this, chat cannot reach your decks or collection.

`setup` writes MCP config and the [agent harness](docs/AGENT_HARNESS.md) (terminal status line on by default; `--no-statusline` to skip).

#### Cursor

```bash
agent-deck setup --client cursor
```

Global: `~/.cursor/mcp.json` · Project: `--scope project` → `.cursor/mcp.json`

Or **Settings → Tools & MCP → Add custom MCP** (HTTP) with the URL above. **Restart Cursor** — `agent-deck` should show connected while `agent-deck start` is running.

#### Claude Code

```bash
agent-deck setup --client claude
```

**Restart Claude Code**, then `claude mcp list` — `agent-deck` should be **Connected**.

### 3. Create a deck

<img src="./misc/UI.png" alt="Dashboard — collection and deck fan" width="70%" />

A **deck** bundles external MCP servers, API keys, and playbooks for one context (e.g. “work”, “this client”).

**Dashboard:** **My Decks** → create a deck → drag cards from **My Collection** (after steps 4–5).

**Agent chat:** ask the agent to create a deck and add cards.

### 4. Register playbooks (agent-first)

Describe the procedure in chat — e.g. *“Add a release checklist playbook with trigger ‘ship to npm’.”* Let the agent register it and attach it to your deck. It can refine the playbook from your feedback over time.

The dashboard can add playbooks too; chat authoring usually works better.

### 5. Add external MCP servers and API keys

Third-party services (Linear, Notion, Slack, …) — **not** `:1110`, which is only the Agent Deck proxy.

| What | Metadata | Secrets / OAuth |
|------|----------|-------------------|
| **External MCP** | Agent or dashboard | **Dashboard** — OAuth in browser |
| **API key** | Agent or dashboard | **Dashboard** — paste once into Keychain |

Drag cards onto your deck in the dashboard, or ask the agent when building the deck.

### 6. Pick a deck each session

**No default deck.** Every new chat is unscoped until you say which deck to use.

*“Use the dev deck”* · *“Work deck for this project”* · mid-session: *“Switch to my personal deck”*

Terminal agents show the active deck in the footer (`◆ dev · 2 MCP · …`). If it stays unbound, check `agent-deck start` and that the deck exists in **My Decks**.

---

## Problem

We lean on one agent for more kinds of work — code, triage, releases, research. Each kind adds **external dependencies**: MCP servers, API keys, OAuth apps, and **playbooks** you want the agent to follow and refine over time.

Some dependencies are **shared** (GitHub, Linear, Slack). Others belong to **one client or repo**. If everything is connected at once, the tool list balloons — the agent slows down, picks the wrong integration, or leaks context across jobs.

Playbooks stay in old threads or docs — you **re-explain the same procedure** every session, and corrections from one chat **don’t carry into the next**.

## Idea

Connect **one** Agent Deck MCP endpoint. Register dependencies and **playbooks** once in a **collection**. **Decks** mix them for each kind of work. Each session, **you name the deck** — there is no default — and only that deck’s tools and playbooks are in play.

When you give feedback on a playbook-backed task, the agent can **update the playbook** so the next run starts from what you taught it — not from scratch.

<img src="./misc/Idea.png" alt="Single MCP for Context" width="70%" />

---

## Reference

For contributors, dev ports (`:3000` / `:8000` / `:3001`) and env vars → [Setup](docs/SETUP.md) · [Development](docs/DEVELOPMENT.md).

**Dashboard:** collection + deck editor · OAuth and API key secrets (Keychain) · per-tool toggles · export/import layouts (`.agent-deck.json`, no secrets) · collection warnings.

**Agent MCP** (`http://127.0.0.1:1110/mcp`): decks, collection, external MCP proxy, playbooks. Secrets, OAuth, and deletes stay on dashboard/CLI. Tool catalog → [MVP](docs/MVP.md).

**CLI:** `agent-deck export` / `import` · `credential` · `exec` (inject keys) · `upgrade`

## Install & run

After first-time [Quick Start](#quick-start):

```bash
agent-deck start --open
agent-deck upgrade
agent-deck stop
```

Port conflicts: `agent-deck status` · `agent-deck start --force`

## Documentation

**Index:** [docs/README.md](docs/README.md)

| Guide | Description |
|-------|-------------|
| [Setup](docs/SETUP.md) | Ports, env vars, secrets, troubleshooting |
| [MVP](docs/MVP.md) | Source of truth — decks, vault, playbooks, MCP tools |
| [Agent harness](docs/AGENT_HARNESS.md) | What `setup` installs |
| [Playbooks vs Cursor skills](docs/PLAYBOOKS_AND_SKILLS.md) | Deck playbooks vs Cursor skills |
| [Export / import](docs/PRD_EXPORT_IMPORT.md) | Portable layout bundles |
| [Deck display](docs/PRD_DECK_DISPLAY.md) | Terminal status line |
| [Architecture](docs/ARCHITECTURE.md) | SQLite, Keychain, components |
| [Development](docs/DEVELOPMENT.md) | Contributors |
| [Publishing](docs/PUBLISHING.md) | npm release |

## Discoverability

| Channel | Notes |
|---------|-------|
| **GitHub** | Demo GIF, this README |
| **npm** | `npm install -g @agent-deck/cli` |
| **MCP Registry** | `server.json` — [Publishing](docs/PUBLISHING.md) |

## What's next

- Cursor plugin packaging (rules / MCP bundle)
- Passthrough for downstream MCP Apps
- Smarter deck recommendations
