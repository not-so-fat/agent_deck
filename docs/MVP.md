# Agent Deck MVP — Development Spec

**Status:** Modules 1–3 implemented (as-built)  
**Doc role:** Product / scope spec (PRD equivalent for this repo)  
**Last aligned:** 2026-06-27  
**Vision / future reference:** [Agent Deck v2](file:///Users/not_so_fat/workspace/Obsidian/lexicon-personal/Ideas/personal/Agent%20Deck%20v2.md) (Obsidian) — full card model, API profiles, workflow tiers, modular roadmap Modules 4–5.

**Goal:** Ship **Modules 1–3** on top of v1 (MCP proxy + decks). Prove unconscious scoping, centralized API keys, and reusable playbooks.

---

## MVP delivers

| Module | Feature | User outcome |
|--------|---------|--------------|
| **1. Scope** | Repo `.agent-deck/deck.yaml` + workspace bind | Open workspace → correct deck, no MCP reconfig |
| **2. Vault** | Credentials in Keychain + `agent-deck exec` | One place for API keys; scripts run without `.env` |
| **3. Playbooks** | Playbook cards + MCP read/write tools | Repeat procedures without re-explaining in chat |

**Explicitly out of MVP scope** (see vision doc): API profile catalog, `call_api`, workflow manifest runner, save-from-chat extractor, progressive tool discovery, session phases.

**In MVP:** API keys via **Credential** cards and env injection — not deferred.

---

## Terminology (as-built)

| Term | Meaning |
|------|---------|
| **Bound deck** | Deck resolved for an **agent** via `bind_workspace` / `AGENT_DECK_WORKSPACE` + `.agent-deck/deck.yaml`, or `x-agent-deck-deck-id`. |
| **Editing deck** | Deck selected in the **dashboard** for layout edits (`localStorage`: `agent-deck-editing-deck-id`). Does not affect agent scope. |
| **My Collection** | Dashboard vault UI — all registered MCP services, API keys, and playbook cards (not a sidebar list). |
| **Legacy active deck** | v1 `decks.is_active` + `POST /api/decks/:id/activate` + `GET /api/decks/active` still exist in the API/DB for backward compatibility; **MVP agent scoping and dashboard do not use them**. |

---

## As-built notes (impl vs original draft)

Changes agreed during MVP implementation:

1. **No global active deck for agents** — scoping is per-workspace manifest, not “one active deck for the whole MCP server.”
2. **MCP tool names** — primary tools use `*_bound_deck_*`; `*_active_deck_*` tools remain as **deprecated aliases**.
3. **Dashboard** — selects an **editing deck** only; copy manifest snippet from deck sidebar; **Import Deck** removed.
4. **API keys** — shown only in **My Collection** (with MCP cards); vault API requires `x-agent-deck-client: dashboard`.
5. **Fixed card colors** — MCP `#39FF14`; API keys `#F9386D`; playbooks `#FFFFFF`; MCP registration no longer exposes a color picker.
6. **MCP card logos** — favicons auto-resolved from MCP URL on register; served at `GET /api/services/:id/icon` (POC shipped).
7. **v1 header migration** — not automated; re-register as Credential + optional `credential_id` on Service.
8. **Playbook cards** — stored in SQLite collection (like MCP/API key cards); markdown body + dependency refs; no filesystem discovery.

---

## Non-goals (MVP)

- Replacing Cursor skill loading mechanism (see [PLAYBOOKS_AND_SKILLS.md](./PLAYBOOKS_AND_SKILLS.md))
- Running or bundling third-party CLIs (only wrap via `exec`)
- Cloud sync / multi-user
- Breaking v1 MCP proxy behavior

---

## Architecture (MVP)

```
┌─────────────────────────────────────────────────────────┐
│  Agent host (Cursor)                                     │
│    └── MCP → localhost:3001/mcp (unchanged entrypoint)   │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  Agent Deck                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │ Deck scope  │  │ Vault        │  │ Playbooks     │ │
│  │ (yaml bind) │  │ (Keychain)   │  │ (cards)       │ │
│  └─────────────┘  └──────────────┘  └───────────────┘ │
│  ┌─────────────┐  ┌──────────────┐                     │
│  │ MCP proxy   │  │ CLI: exec    │                     │
│  │ (v1)        │  │              │                     │
│  └─────────────┘  └──────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

---

## Module 1 — Scope

### Repo deck manifest (lightweight)

Many repos can share one deck (N repos → 1 deck). Each repo points at a deck:

```yaml
# .agent-deck/deck.yaml
deck_id: "<uuid-from-dashboard>"
name: Hiring stack   # optional, for humans reading the repo
```

**Agent binding** (no global active deck):

1. MCP `bind_workspace({ workspaceRoot })` or env `AGENT_DECK_WORKSPACE=/path/to/repo`
2. Backend reads `.agent-deck/deck.yaml` → `deck_id`
3. Agent APIs use header `x-agent-deck-workspace` (or `x-agent-deck-deck-id`)

**Dashboard** does not activate decks for agents. It only **edits** whichever deck you select (UI state in `localStorage`). Copy the manifest snippet from the deck sidebar (copy icon) into repos that should use that deck.

Monorepo conventions: [MONOREPO_SCOPE.md](./MONOREPO_SCOPE.md).

### Behavior

1. Agent calls `bind_workspace` with the repo root (or MCP env sets `AGENT_DECK_WORKSPACE`).
2. If `.agent-deck/deck.yaml` exists → scope MCP services + credentials to `deck_id`.
3. No fallback to a global active deck or `decks.is_active`.

### Deliverables

- [x] Schema for `.agent-deck/deck.yaml` (`deck_id`, optional `name`)
- [x] Backend: resolve manifest, `GET /api/scope/deck`, `POST /api/scope/resolve`
- [x] MCP: `bind_workspace`, `get_repo_deck_status`, `setup_repo_deck`, `get_bound_deck` (deprecated `get_active_deck` alias)
- [x] Dashboard: editing deck selector, copy manifest snippet
- [x] Docs: monorepo convention — [MONOREPO_SCOPE.md](./MONOREPO_SCOPE.md)

---

## Module 2 — Vault (API keys)

### Credential model (MVP)

Single card type — no separate Secret entity in UI (Keychain is storage backend).

```yaml
# ~/.agent-deck/credentials/cred_ashby.yaml (metadata only)
id: cred_ashby
label: Ashby API
scheme: http_basic_user    # bearer | header | http_basic_user
header_name: null          # for scheme: header
env_name: ASHBY_API_KEY    # injected by exec
tags: [hiring]
```

Value stored in **macOS Keychain** (service: `agent-deck`, account: `cred_ashby`). SQLite holds metadata only.

### Who sets `id`, `env_name`, and `scheme`?

| Field | Dashboard (human) | CLI / REST (power user) | Agent |
|-------|-------------------|-------------------------|-------|
| `label`, secret value | User enters name + key | User or script | Should not register secrets in chat |
| `id` (`cred_*`) | **Auto** from label slug | Optional override | Read-only; use ids from bound deck |
| `env_name` | **Auto** (`OPENAI_API_KEY` style) | Optional `--env-name` | Read-only; use for `exec` / scripts |
| `scheme` | **Auto** (`bearer` default) | Optional `--scheme` | Read-only |

Humans never pick env var names in the UI. Agents **discover** metadata via the bound deck — they do not invent env names at runtime.

### Deck scoping (strict enforcement)

- **Vault (collection)** = all registered API keys. Dashboard only via `GET /api/credentials/vault` with header `x-agent-deck-client: dashboard`.
- **Bound deck** = project boundary for agents. Agents only see credentials on the deck resolved from workspace manifest (or explicit deck id header).
- **Editing deck (dashboard)** = drag target for MCP and API key cards. Drag onto deck to link; drag out to unlink — keys stay in the vault.

Client header `x-agent-deck-client`:

| Value | Client | Credential access |
|-------|--------|-------------------|
| `dashboard` | Agent Deck UI | Full vault CRUD; deck linking for any deck |
| `agent` or omitted | MCP / scripts | Bound-deck mutations only; collection metadata read; no secret CRUD |

**Dashboard-only (human-in-the-loop):**

- API key **secret** create, rotate, update value (`POST/PUT/rotate /api/credentials`)
- MCP **OAuth** browser flow (`/api/oauth/*`)

**Agent MCP tools (collection + bound deck):**

| Tool | Purpose |
|------|---------|
| `bind_workspace` / `setup_repo_deck` | Bind session to repo; read `deck.yaml` |
| `get_bound_deck`, `get_decks`, `create_deck` | Deck read/create |
| `list_collection_services` / `register_service` / `update_service` / `delete_service` | MCP collection CRUD |
| `add_service_to_bound_deck` / `remove_service_from_bound_deck` | Link MCP cards on bound deck |
| `update_service_tool_settings` | Enable/disable tools (service must be on bound deck) |
| `list_collection_credentials` | API key metadata (no secrets) for linking |
| `add_credential_to_bound_deck` / `remove_credential_from_bound_deck` | Link API key cards (secret stored in dashboard/CLI) |
| `list_playbooks` / `list_collection_playbooks` / `register_playbook` / `update_playbook` / `delete_playbook` | Playbooks |
| `add_playbook_to_bound_deck` / `remove_playbook_from_bound_deck` | Link playbook cards |
| `list_bound_deck_*` | Bound deck services/credentials |
| `list_service_tools` / `call_service_tool` | Proxy to services on bound deck |

Deprecated aliases: `get_active_deck`, `list_active_deck_*`. Agents use `GET /api/credentials/collection` (metadata) — not `/api/credentials/vault`.

### Dashboard UI (Module 2)

- **My Collection** — MCP, API key, and playbook playing cards (MCP `#92E4DD`, API key `#F9386D`, playbook `#FFFFFF`).
- **Deck editor** — fan of cards for the **editing deck**; drag-and-drop from collection (agents can also link via MCP tools).
- **Register MCP / Register API key** — modals; MCP color picker removed.
- **MCP logos** — auto-fetched favicon on register; `iconUrl` → `GET /api/services/:id/icon`.

### Agent-facing REST (metadata only — never secret values)

```http
GET /api/credentials
→ bound-deck credentials only (requires x-agent-deck-workspace or x-agent-deck-deck-id)

GET /api/credentials/vault
→ dashboard header required; full vault for My Collection

GET /api/credentials/:id
→ 403 unless credential is on bound deck (dashboard: full access with header)

GET /api/decks
→ agent: credentials stripped from non-bound decks

POST /api/decks/:deckId/credentials   { credentialId }   (agent: bound deck only)
DELETE /api/decks/:deckId/credentials   { credentialId }   (agent: bound deck only)

GET /api/credentials/collection
→ all credential metadata (no secrets); agent-safe for linking

GET /api/playbooks/collection
→ all playbook cards; agent-safe for linking
```

**Legacy (v1, not used for MVP agent scoping):**

```http
GET /api/decks/active
POST /api/decks/:id/activate
```

See **Agent MCP tools** table above for the full tool surface.

**Exec injection:** `agent-deck exec --deck <id> --connections cred_a,cred_b -- <cmd>` validates each credential is on the deck when `--deck` is set. Agents run scripts; they never receive raw keys in tool results.

### Migration from v1

- Existing `services.headers` with `Authorization` → **manual**: create Credential + Keychain entry, set `credential_id` on Service (no auto-migration).
- MCP services may reference `credential_id` instead of inline headers.

### CLI: `agent-deck exec`

```bash
agent-deck exec \
  --deck <deck-id> \
  --connections cred_ashby,cred_openai,cred_slack \
  [--dry-run] \
  -- <command...>
```

Behavior:

1. Resolve each credential → fetch from Keychain.
2. Build env map from `env_name` → value.
3. Spawn child with inherited env + injected vars (never print secrets).
4. Log credential **ids** used (audit), not values.

Subcommands (MVP):

```bash
agent-deck credential add cred_ashby --env-name ASHBY_API_KEY --scheme http_basic_user
agent-deck credential list
agent-deck credential rotate cred_ashby   # prompt for new value
```

Package: `packages/cli`.

### Deliverables

- [x] Keychain adapter (macOS first; Linux secret-service later)
- [x] Credential CRUD API + dashboard UI (My Collection cards)
- [x] `packages/cli` with `exec` subcommand
- [ ] Migrate v1 header storage (manual only; see Migration from v1)
- [x] Tests: exec injects env; agent MCP cannot read raw values

---

## Module 3 — Playbooks (cards)

### Playbook card model

Playbooks are **first-class cards** in My Collection — same lifecycle as MCP and API key cards:

- Register in dashboard → appears in **My Collection** (white `#FFFFFF`, label **PB**)
- Drag onto a **deck** to scope for agents
- Agent retrieves via `list_playbooks` / `get_playbook` (bound deck only)

Stored in SQLite (`playbooks` + `deck_playbooks`). Body is markdown; metadata includes triggers, optional exec/skill hints, and **dependencies** on other cards.

**Playbooks vs Cursor Skills:** playbooks are scoped runbooks on the deck connection graph; skills are repo-native agent behavior. They complement each other — see [PLAYBOOKS_AND_SKILLS.md](./PLAYBOOKS_AND_SKILLS.md).

```typescript
{
  id: "pb_hiring_inbox",       // auto from title slug
  title: "Hiring inbox",
  body: "# Steps\n1. …",       // markdown instructions / API guides
  triggers: ["check inbox"],
  dependsOnCredentialIds: ["cred_ashby", "cred_openai"],
  dependsOnServiceIds: ["<mcp-service-uuid>"],
  exec: "agent-deck exec …",   // optional
  skill: ".cursor/skills/…"    // optional
}
```

### Dependencies

- Declared manually (optional checkboxes in dashboard) or **auto-detected** on save from content — dashboard POST and agent `register_playbook` / `update_playbook` (matches `cred_*` ids, env names, MCP names/uuids, and `--connections` flags in body/exec)
- **Details modal** shows resolved dependencies + warnings for missing refs
- **Delete API key / MCP** → blocked (409) if any playbook references it
- **Remove from deck** (drag out) → confirm if playbooks depend on that card

### Agent API

```http
GET /api/playbooks/vault          → dashboard: all playbook cards
GET /api/playbooks                → agent: playbooks on bound deck
GET /api/playbooks/summaries      → agent: id, title, triggers
GET /api/playbooks/:id            → full body + dependencies
GET /api/playbooks/dependents/check?credentialId=…|serviceId=…

POST   /api/playbooks             → create card + auto-detect deps (dashboard and agent)
PUT    /api/playbooks/:id         → update + re-detect deps (dashboard: any; agent: on bound deck)
DELETE /api/playbooks/:id         → dashboard: delete

POST   /api/decks/:deckId/playbooks   { playbookId }
DELETE /api/decks/:deckId/playbooks   { playbookId }
```

### MCP tools (`:3001/mcp`)

| Tool | Args | Returns |
|------|------|---------|
| `list_playbooks` | — | Playbook summaries on bound deck |
| `get_playbook` | `playbook_id` | Full body + dependencies |
| `register_playbook` | `title`, `body`, optional `triggers`, `playbook_id`, `exec`, `skill`, dependency overrides, `add_to_bound_deck`, `auto_detect_dependencies` | Created playbook + resolved dependencies |
| `update_playbook` | `playbook_id`, optional fields above | Updated playbook + resolved dependencies |

No `run_playbook` executor — agent reads content and follows steps.

### Dashboard

- **Register playbook** button (sidebar, white card style)
- Playbook cards in **My Collection** with drag-and-drop; dependencies auto-detected on save
- **Details** on click — instructions, dependencies, missing-ref warnings

### Examples

Template content for registration: [docs/examples/playbooks/](./examples/playbooks/) (copy into Register playbook form — not auto-loaded from disk).

### Deliverables

- [x] Playbook card schema + SQLite storage
- [x] CRUD API + deck linking
- [x] Dependency warnings on delete / deck removal
- [x] MCP tools `list_playbooks`, `get_playbook`, `register_playbook`, `update_playbook`
- [x] Dashboard: collection cards + registration + details modal
- [x] Example markdown in `docs/examples/`

---

## Reference integration — hiring CLI (Ashby)

Dogfood target for Modules 2–3. External repo: `ashby-triage` (local Python CLI).

### Connection map

| Credential | env var | Used by |
|------------|---------|---------|
| `cred_ashby` | `ASHBY_API_KEY` | Ashby REST (HTTP Basic) |
| `cred_openai` | `OPENAI_API_KEY` | LLM triage |
| `cred_slack` | `SLACK_BOT_TOKEN` | Post decisions |

No MCP for Ashby — validates **API key + exec** path.

### Target layout (in ashby-triage repo, not agent_deck)

```
ashby-triage/
  .agent-deck/
    deck.yaml
  roles/              # unchanged — user's domain logic
  .claude/skills/hiring/SKILL.md
```

Register hiring playbooks as **cards** in Agent Deck (dashboard or `register_playbook` MCP tool). Sample content: [docs/examples/playbooks/](./examples/playbooks/).

### MVP validation commands

```bash
# Register creds once (global store)
agent-deck credential add cred_ashby --env-name ASHBY_API_KEY --scheme http_basic_user
agent-deck credential add cred_openai --env-name OPENAI_API_KEY --scheme bearer
agent-deck credential add cred_slack --env-name SLACK_BOT_TOKEN --scheme bearer

# Run without .env
cd ashby-triage
agent-deck exec --deck <deck-id-from-yaml> --connections cred_ashby,cred_openai,cred_slack -- \
  uv run hiring inbox --dry-run
```

### Agent path (Module 3)

1. `bind_workspace` → bound deck includes hiring playbook cards + cred refs (linked in dashboard).
2. User: “Check hiring inbox.”
3. Agent: `get_playbook(pb_hiring_inbox)` → follows steps → suggests `agent-deck exec …`.
4. Agent refines playbook via `update_playbook` after a run (dependencies re-detected automatically).

### Future (Module 4–5, vision doc only)

- API profile `api_ashby` with endpoint catalog
- Workflow card Tier 2 binding CLI permanently
- Manifest for confirm loops / SQLite cache

---

## Implementation order (historical)

1. **Module 2** (vault + exec)
2. **Module 1** (repo deck yaml)
3. **Module 3** (playbooks + MCP tools)

---

## Success criteria

- [x] Open `agent_deck` repo in Cursor → v1 MCP proxy still works.
- [ ] Register 3 credentials; run hiring CLI via `exec` with no `.env` (dogfood in external `ashby-triage` repo).
- [x] Playbook markdown discoverable; agent retrieves via `get_playbook`.
- [x] No secret values in SQLite, MCP responses, or logs.
- [x] README links to this doc (see [README](../README.md); user-facing tool list may still mention legacy names — prefer this doc for MVP behavior).

---

## Resolved decisions

| Question | Decision |
|----------|----------|
| Deck yaml links DB deck vs inline services | **`deck_id`** — reuse v1 dashboard |
| Credential store path | **`~/.agent-deck/credentials/`** yaml + Keychain |
| Linux vault | macOS first; stub Linux |
| CLI package location | **`packages/cli`** |
| Global active deck vs workspace bind | **Workspace bind** for agents; dashboard uses editing deck only |
| MCP tool naming | **`*_bound_deck_*`** primary; `*_active_deck_*` deprecated |
| Card colors | **Fixed** by type (MCP green, API key magenta, playbook white) |
| API key UI location | **My Collection** cards only (not sidebar vault list) |

---

## Related docs

- [PLAYBOOKS_AND_SKILLS.md](./PLAYBOOKS_AND_SKILLS.md) — when to use playbooks vs Cursor skills
- [MONOREPO_SCOPE.md](./MONOREPO_SCOPE.md) — monorepo `deck.yaml` placement
- [ARCHITECTURE.md](./ARCHITECTURE.md) — v1 system (may predate bound-deck terminology)
- [DEVELOPMENT.md](./DEVELOPMENT.md) — run locally
- [MCP_APP.md](./MCP_APP.md) — in-chat UI
- [examples/playbooks/](./examples/playbooks/) — sample playbook markdown
- Vision: Agent Deck v2 (Obsidian) — API profiles, three scenarios, Modules 4–5
