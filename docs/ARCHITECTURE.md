# Agent Deck — Technical Architecture

**Doc role:** Technical design (components, data, secrets)  
**Product behavior & MCP tools:** [MVP.md](./MVP.md) — source of truth for bound deck, agent API, terminology  
**Last aligned:** 2026-06-30

---

## Overview

Agent Deck is a local TypeScript monorepo: React dashboard, Fastify API, MCP proxy, SQLite + OS secret store. Agents connect to **one MCP endpoint**; the **bound deck** (workspace manifest or session bind) determines which MCP tools are visible.

---

## Why TypeScript end-to-end

- Shared types/schemas in `packages/shared` (Zod)
- Single runtime (Node) for API, MCP, CLI
- Vitest across packages

---

## System diagram

**Dev repo** (`npm run dev:all`): dashboard :3000, API :8000, MCP :3001, data `~/.agent-deck/dev/`  
**CLI / npx** (`agent-deck start`): dashboard + API :11111, MCP :11112, data `~/.agent-deck/`

See [SETUP.md](./SETUP.md#ports) for overrides.

```
┌─────────────┐     ┌─────────────┐
│  Dashboard  │     │ MCP server  │
│  (React)    │     │ (MCP SDK)   │
└──────┬──────┘     └──────┬──────┘
       │    REST + WS      │
       └─────────┬─────────┘
                 ▼
          ┌─────────────┐
          │ Backend API │
          │  (Fastify)  │
          └──────┬──────┘
                 ▼
          ┌─────────────┐     ┌──────────────┐
          │   SQLite    │     │ Keychain /   │
          │ agent_deck  │     │ dev secrets  │
          └─────────────┘     └──────────────┘
```

---

## Components

| Package / app | Path | Role |
|---------------|------|------|
| **Shared** | `packages/shared/` | Types, Zod schemas, shared utils |
| **Backend** | `packages/backend/` | Fastify API, SQLite, OAuth, vault, MCP server |
| **CLI** | `packages/cli/` | `start`, `setup`, `credential`, `exec`, harness installer |
| **Dashboard** | `apps/agent-deck/` | Collection, deck editor, OAuth UI, WebSocket updates |

MCP entry: `packages/backend/src/mcp-server.ts` · MCP process: `mcp-index.ts`

---

## Data model (SQLite)

Metadata in `agent_deck.db`; **secrets not in SQLite** (see [Secret storage](#secret-storage)).

| Table | Purpose |
|-------|---------|
| `services` | MCP / A2A / local-mcp cards, OAuth metadata |
| `decks` | Deck records (`is_active` legacy only) |
| `deck_services` | MCP cards on a deck + order |
| `credentials` | API key metadata |
| `deck_credentials` | Key cards on a deck |
| `playbooks` | Playbook card bodies + deps |
| `deck_playbooks` | Playbook cards on a deck |
| `exec_runs` | CLI exec audit |

Canonical types: `packages/shared/src/schemas/`. Credential yaml mirror: `~/.agent-deck/credentials/*.yaml`.

**Agent scoping:** bound deck via workspace — [MVP.md](./MVP.md) Module 1. Legacy `GET /api/decks/active` exists; agents use bound-deck paths only.

---

## Secret storage

Implementation: `packages/backend/src/vault/`.

| Class | Keychain / file account | SQLite retains |
|-------|-------------------------|----------------|
| API keys | `cred_{id}` | label, scheme, `env_name`, tags |
| OAuth client secret | `oauth-client-secret:{serviceId}` | client id, URLs, scope |
| OAuth tokens | `oauth-tokens:{serviceId}` | expiry, `oauth_has_token` |

**Flow:** `OAuthManager` writes tokens after exchange/refresh. `MCPClientManager` resolves tokens when opening a connection. API returns `oauthHasToken`, never bearer strings.

**Migration:** legacy plaintext in `services.oauth_*` migrates to Keychain on first read; duplicate `Authorization` in `headers` stripped.

**Performance:** Keychain ops are sub-ms to a few ms — negligible vs MCP network latency.

**Threat model:** protects casual DB copy; not a substitute for full-disk encryption or compromised user session.

---

## Local MCP servers

- Type `local-mcp`: stdio child process, started on demand
- Config import: `POST /api/local-mcp/import` (JSON / Cursor-style manifest)
- Routed through same MCP proxy as remote services once on the bound deck

---

## MCP & REST surfaces

**Do not duplicate here.** Full tool list, REST agent vs dashboard headers, and scoping rules:

→ **[MVP.md](./MVP.md)** (Modules 1–3, agent MCP tools, credential access)

High level:

- Agents: `bind_workspace` → tools on **bound deck** only
- Dashboard: `x-agent-deck-client: dashboard` for vault CRUD and OAuth browser flows
- Deprecated MCP aliases: `*_active_deck_*` → use `*_bound_deck_*`

---

## Key patterns

- **Validation:** Zod at API boundary (`packages/shared` schemas)
- **API shape:** `{ success, data?, error? }`
- **Real-time:** WebSocket ` /api/ws/events` for dashboard
- **Session bind:** in-memory per MCP session — `McpSessionBindingStore`

---

## Related docs

- [MVP.md](./MVP.md) — shipped product scope
- [SETUP.md](./SETUP.md) — install, ports, dashboard tour
- [DEVELOPMENT.md](./DEVELOPMENT.md) — contributor workflow
- [AGENT_HARNESS.md](./AGENT_HARNESS.md) — Cursor / Claude rules from `setup`
