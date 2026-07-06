# Changelog

## 1.3.4 — 2026-07-06

### Security

- **MCP proxy:** bind to loopback by default (`AGENT_DECK_MCP_HOST`, default `127.0.0.1`) — fixes LAN exposure on port 1110
- **REST backend:** default `HOST` is `127.0.0.1` instead of `0.0.0.0`
- **CORS:** restrict browser origins to dashboard/dev loopback URLs (or `AGENT_DECK_DASHBOARD_ORIGIN`)

### Packaging & CI

- License metadata standardized to MIT across all published packages; `LICENSE` included in npm tarballs
- GitHub Actions CI: install → rebuild-native → test → type-check
- Commit `.mcp.json` contributor wiring for loopback MCP URL

## 1.3.3 — 2026-07-05

### Dashboard

- **OAuth:** collection cards refresh after connect (popup `postMessage`, WebSocket, service modal close)
- **MCP tools:** clearer tool descriptions in the service details panel (summary + expand for long text)
- Empty deck builder placeholder centered; playbook details modal widened
- Updated README screenshots (`misc/Idea.png`, `misc/UI.png`)

### README

- Problem / Idea call out **self-improving skills** — feedback updates deck skills across sessions

## 1.3.2 — 2026-07-05

### Default ports (CLI / npx)

Fresh installs use shorter localhost ports:

| Surface | Port |
|---------|------|
| Dashboard | `http://127.0.0.1:1111` |
| Agent Deck MCP | `http://127.0.0.1:1110/mcp` |

Dev workflow unchanged (`8000` API, `3000` UI, `3001` MCP). Re-run `agent-deck setup` if your host still points at `11111` / `11112`.

### README & docs

User-facing Quick Start (global install, macOS Keychain warning, Cursor vs Claude MCP registration, agent-first skills). Tagline and Problem/Idea sections refreshed.

### Dashboard

- Home page ambient orbs animate again
- Browser tab title: **AgentDeck**
- Create-deck dialog: name only (matches deck model)

### Deck model

Removed unused `description` field from decks (schema, API, MCP `create_deck`, export bundles). Existing SQLite DBs migrate on startup; legacy export bundles with `description` still import.

## 1.3.1 — 2026-07-04

### Export / import (metadata layouts)

Port MCP, playbook, and deck layouts between machines or share deck templates. **No credentials or secrets** in the bundle.

```bash
agent-deck export all -o backup.agent-deck.json
agent-deck export deck <uuid> -o my-deck.agent-deck.json
agent-deck import backup.agent-deck.json
```

- **Dashboard:** My Collection **Export all** / **Import**; per-deck **Export** on My Decks
- **REST:** `POST /api/export`, `POST /api/import` (dashboard client only)
- **Import:** try create; **skip** when display name already exists (same name = same card/deck), link membership, report `created` / `reused` + warnings
- **Unique names:** deck `name`, service `name`, playbook `title`, credential `label` enforced in SQLite

### Dashboard UX

- Narrow / portrait layout scrolls (Glass-friendly); wide layout unchanged
- Inline rename for deck name (builder header) and service name (details modal)
- Removed per-card color picker (colors fixed by type)

## 1.3.0 — 2026-07-03

### MCP tool surface (breaking for agents & playbooks)

Default MCP catalog is **~16 tools** (was ~31). Hot path: `bind_workspace` → `get_bound_deck` → `call_service_tool` / `get_playbook`.

| New / primary | Replaces (removed from default) |
|---------------|----------------------------------|
| `get_bound_deck` (includes services, credentials, playbook summaries, `display_summary`) | `list_playbooks`, `list_bound_deck_services`, `list_bound_deck_credentials`, `list_active_deck_*`, `get_active_deck` |
| `manage_deck_card` (`action`: link \| unlink \| reorder, `card_type`, `card_id`) | `add_*_to_bound_deck`, `remove_*_from_bound_deck` (×3 card types) |
| `list_collection` (optional `card_type`) | `list_collection_services`, `list_collection_credentials`, `list_collection_playbooks` |
| `create_deck` | (unchanged; always on default profile) |

**Removed from MCP (use CLI / dashboard):** `delete_service`, `delete_playbook`.

```bash
agent-deck service list|delete <id>
agent-deck playbook list|delete <id>
agent-deck deck list|delete <id>
```

**Still on MCP:** `register_playbook`, `update_playbook`, `get_playbook`, `register_service`, `update_service`, `call_service_tool`, bind/session tools.

Optional: `AGENT_DECK_MCP_TOOL_PROFILE=legacy` restores old tool names for one release while you migrate playbooks. Dynamic mid-session tool loading is **not** supported (Cursor/Claude ignore `list_changed`).

### Playbooks — update required

Any playbook body (or skill/rule) that names old MCP tools will fail after upgrade. Search deck playbooks for the left column and rewrite:

| Old (broken on default MCP) | New |
|-----------------------------|-----|
| `list_playbooks` | `get_bound_deck` → read `playbooks` (id, title, triggers) |
| `list_bound_deck_services` / `list_bound_deck_credentials` | `get_bound_deck` |
| `add_service_to_bound_deck` / `add_credential_to_bound_deck` / `add_playbook_to_bound_deck` | `manage_deck_card` with `action: "link"`, matching `card_type` + `card_id` |
| `remove_*_from_bound_deck` | `manage_deck_card` with `action: "unlink"` |
| `list_collection_*` | `list_collection` |
| `delete_service` / `delete_playbook` | CLI: `agent-deck service delete` / `agent-deck playbook delete` |

`get_playbook` and `update_playbook` are unchanged.

### Harness (Cursor / Claude instructions)

Templates now use `get_bound_deck` (not `list_playbooks` / `list_bound_deck_services`). **Re-run setup** or agents keep calling removed tools:

```bash
agent-deck setup --client cursor   # refreshes ~/.cursor/rules/agent-deck.mdc
agent-deck setup --client claude   # refreshes harness block in CLAUDE.md
```

Then **restart Cursor / Claude Code** so MCP tool cache matches the new catalog.

### Upgrade from 1.2.x

1. **Install globally:** `npm i -g @agent-deck/cli@1.3.0`
2. **Restart:** `agent-deck stop && agent-deck start` (and `npm run dev:all` if you use `:3001` dev MCP)
3. **Restart Cursor / Claude Code** — clears stale MCP tool cache
4. **Re-run setup:** `agent-deck setup --client cursor` (or `claude`) — refreshes harness
5. **Update playbooks** — replace old tool names per table above (or temporarily `AGENT_DECK_MCP_TOOL_PROFILE=legacy`)

### Tests

- **MCP golden paths (CI)** — `golden-path.http.test.ts`: bind, `get_bound_deck`, `manage_deck_card` link/unlink, playbook get/update, `call_service_tool`, `create_deck`, catalog snapshot
- **Harness** — templates must not name removed tools (`list_playbooks`, `add_*_to_bound_deck`, …)
- **CLI rare ops** — `cli-runtime` delete + dependency block; collection-admin arg wiring
- **Release smoke** — after `setup --client cursor`, harness contains `get_bound_deck` and no removed tool names
- **FE (Vitest)** — dashboard drag link/unlink for service, credential, playbook (`useDragAndDrop.deck-link.test.tsx`)
- **Statusline / menubar (CI)** — bound + offline paths against HTTP stub (`display-surfaces.http.test.ts`); release-smoke installs menubar plugin script contract

## 1.2.10 — 2026-07-03

### Session-only binding (repo deck removed)

- **`bind_workspace` requires `deckId`** — `get_decks` then `bind_workspace({ workspaceRoot, deckId })`; no `.agent-deck/deck.yaml`
- **Removed** — `setup_repo_deck`, `get_repo_deck_status`, `POST /api/scope/resolve`, `GET /api/scope/manifest-template`, `repo-deck-init` on project setup
- **Harness** — session opener uses `get_decks` + `deckId`; re-run `agent-deck setup` to refresh global Cursor/Claude rules
- **Dashboard** — copy deck id (not yaml snippet) from My Decks

### Menu bar & session badges

- **SwiftBar menubar** — `agent-deck menubar`; default on macOS `setup` (`--no-menubar` to skip); brew + plugin folder auto-config
- **Session badges** — `⌘word` per MCP session in menubar, statusline `display_summary`, and `GET /api/scope/bindings`
- **Dashboard** — live session chip in page header (replaces old editing-deck name/cards chip); My Decks shows `N cards, M sessions`; Deck panel keeps `{name} ({n} cards)`

### Upgrade from 1.2.9

1. **Install globally:** `npm i -g @agent-deck/cli@1.2.10`
2. **Restart:** `agent-deck stop && agent-deck start` (and `npm run dev:all` if you use `:3001` dev MCP)
3. **Restart Cursor** — clears stale MCP tool cache (`setup_repo_deck` ghosts when `agent-deck-dev` was cached)
4. **Re-run setup:** `agent-deck setup --client cursor` (or `claude`) — refreshes harness + menubar plugin
5. **Bind with deck id:** agent calls `get_decks`, then `bind_workspace({ workspaceRoot, deckId })`
6. **Delete leftover** `.agent-deck/deck.yaml` — ignored by the server; confuses agents if left in repo

### Tests

- **`tools/list` regression** — asserts `setup_repo_deck` / `get_repo_deck_status` are not registered and `bind_workspace` requires `deckId`

## 1.2.9 — 2026-07-03

### Deck display — live MCP reality only

- **Live registry** — `bind_workspace` / `switch_bound_deck` register display state on the backend; status line shows only active MCP session binds
- **Unbound at launch** — no sidecar, manifest, or env guessing before `bind_workspace`
- **Removed** — `bindings.json` sidecar writes/reads, workspace/session sidecar lookup, CLI sidecar fallback
- **Unbound copy** — `◆ Unbound — bind a deck to use Agent Deck`; optional `· MCP offline` when backend is up but MCP is down
- **MCP health** — backend receives `AGENT_DECK_MCP_PORT` from `agent-deck start`; dev `dev:all` exports `:3001`; skip false offline when a live bind exists

### Upgrade from 1.2.8

1. **Install globally** (avoids slow `npx` on every statusline refresh): `npm i -g @agent-deck/cli@1.2.9`
2. **Restart backend:** `agent-deck stop && agent-deck start` (or `setup --client claude --start`)
3. **Re-run setup:** `agent-deck setup --client claude` — refreshes `statusline.sh`
4. **Re-bind once per MCP session:** ask the agent to `bind_workspace` (footer is unbound until bind)
5. **Monorepo dev:** set `AGENT_DECK_PORT=8000` for Claude statusline; restart `npm run dev:all` after pull

Optional: delete stale `~/.agent-deck/bindings.json` (ignored in 1.2.9).

If the footer still shows a deck before bind, statusline is hitting the wrong API (`:11111` prod vs `:8000` dev) — set `AGENT_DECK_PORT` to match your MCP backend.

## 1.2.8 — 2026-07-02

### Deck display — upgrade fix

- **Legacy sidecar fallback** — pre-1.2.7 workspace-keyed `bindings.json` entries still resolve when `session_id` is missing or not yet written
- **Statusline API handling** — trust any successful `/api/scope/display` response (fixes `◆ —` incorrectly falling through to **Agent Deck offline**)

### Upgrade from 1.2.6 / 1.2.7

1. **Install globally** (avoids slow `npx` on every statusline refresh): `npm i -g @agent-deck/cli@1.2.8`
2. **Restart backend:** `agent-deck start` (or `setup --client claude --start`)
3. **Re-run setup:** `agent-deck setup --client claude` — refreshes `statusline.sh` and drops `refreshInterval`
4. **Re-bind once per session:** ask the agent to `bind_workspace` (writes session-keyed sidecar)

If the footer still says **Agent Deck offline**, the statusline subprocess cannot reach `http://127.0.0.1:11111` (backend stopped) or is timing out (install global CLI; Claude `statusLine.timeoutMs` ≥ 3000).

## 1.2.7 — 2026-07-02

### Deck display (terminal status line)

- **Session-scoped bindings** — `bindings.json` keyed by session id (not workspace path); `GET /api/scope/display?sessionId=`; statusline reads host `session_id` from stdin
- **Event-driven refresh** — setup no longer sets `refreshInterval` (Claude) or timer polling; host refreshes on prompt/conversation update
- **Timestamp suffix** — bound lines show `(updated YYYY-MM-DD HH:mm)` from last bind; offline shows last known time when available

### Dashboard

- **My Collection:** flex layout fills remaining column height; card grid scrolls inside panel; `5rem` column width + right padding so fan overlap is not clipped
- **Deck fan:** hide scroll chevrons at scroll ends (no disabled ghost buttons); remove edge gradients; stronger chevron styling

### Upgrade from 1.2.6

1. **Install globally:** `npm i -g @agent-deck/cli@1.2.7`
2. **Restart backend:** `agent-deck start`
3. **Re-run setup:** `agent-deck setup --client claude`
4. **Re-bind once per session:** `bind_workspace` in agent chat

## 1.2.6 — 2026-07-02

### Dashboard

- **Deck fan:** fix right-edge clipping at 10 cards (viewport includes horizontal padding); clickable scroll chevrons; align Deck panel height with My Decks (`h-80`); remove spurious scrollbar on yellow drop zone
- **MCP tools panel:** resync disabled-tool state when tool list changes after reconnect (not only when count changes)

### Backend

- **Agent API:** redact OAuth tokens, client secrets, `Authorization` headers, and `localEnv` from deck service payloads returned to agent clients (`get_decks`, bound deck reads)
- **MCP client cache:** invalidate cached connection on tool discovery failure (same as tool-call failures)

### Docs

- **README:** end-user Quick Start only — dev clone/`dev:all` moved to [DEVELOPMENT.md](docs/DEVELOPMENT.md)
- **SETUP.md:** document Claude Code stale MCP tool index after reconnect (session restart workaround)

## 1.2.5 — 2026-07-01

### Deck display — terminal only

- **Removed Cursor IDE extension** — deck display is terminal `statusLine` only (Claude Code / Cursor CLI); IDE Agent chat has no host footer API
- **Harness session opener** — on first turn: `bind_workspace` → `get_session_binding` → show `display_summary` to user (Glass/IDE workaround)
- **Status line:** open-stdin host contract (no hang when Claude leaves pipe open); `readStdin` idle timeout; prod port `11111` before dev `8000` unless `AGENT_DECK_DEV`
- **`setup --scope project`** — `repo-deck-init` writes/repairs `.agent-deck/deck.yaml`

### Process & docs

- `.cursor/rules/user-surface-feasibility.mdc` — gate user-visible surfaces; no IDE display claims
- Release playbooks + smoke aligned to terminal-only scope
- [PUBLISHING.md](docs/PUBLISHING.md), [PRD_DECK_DISPLAY.md](docs/PRD_DECK_DISPLAY.md) — IDE extension removed from distribution story

## 1.2.4 — 2026-07-01

### Deck display & CLI

- **`setup` installs deck status line by default** for Claude Code / Cursor CLI (`--no-statusline` to skip); writes `~/.agent-deck/bin/statusline.sh` and merges `statusLine` into client settings
- **Status line:** prefer `workspace.project_dir`; walk up bindings sidecar; fall through when prod API is unbound but dev/prod sidecar has a bind; strip ANSI; `NO_COLOR` + stderr redirect in wrapper (no `npm warn` on stdout); **stdin host-contract tests** (Claude leaves pipe open)
- **Bindings sidecar:** backend merges prod + dev `bindings.json` for `GET /api/scope/display`
- **`npm run release:smoke`** — fresh-`HOME` setup + artifact checks; runs in `build:release` before publish

### Backend

- **MCP auth:** resolve `service.credentialId` from vault into outbound requests; stop stripping manual `Authorization` when OAuth is absent; merge custom headers before OAuth overrides
- **MCP errors:** clearer parsing for plain JSON auth failures (e.g. Docmost `401 Unauthorized`)

### Harness & docs

- Agent harness: connect MCP before `bind_workspace`
- Release playbooks + `.cursor/rules/release-integration-smoke.mdc`; generic playbook `pb_user_path_integration_smoke`

## 1.2.3 — 2026-07-01

### Deck display (Phase 5a) — on npm

- **Bindings sidecar** (`~/.agent-deck/bindings.json`) written on `bind_workspace` / `switch_bound_deck`
- **`GET /api/scope/display`** — resolved bound deck + `displayLine` for status surfaces
- **CLI** `agent-deck statusline` command (installer wiring completed in 1.2.4)
- **MCP** `get_session_binding.display_summary` and `agent-deck://bound-deck/summary` resource
- Shared `deck-display` schemas; `resolveAgentDeckHome` in `@agent-deck/shared`

### Backend fixes — on npm

- MCP client: stop setting global `Content-Type` on transport headers (fixes Streamable HTTP GET probes)
- Smarter SSE fallback — skip when Streamable HTTP returns actionable 4xx/5xx; prefer Streamable error over misleading SSE “Invalid content type”
- Streamable HTTP first, legacy SSE fallback only for ambiguous failures

### Docs — on npm

- [PUBLISHING.md](docs/PUBLISHING.md) — distribution model (CLI + terminal statusline)
- [PRD_DECK_DISPLAY.md](docs/PRD_DECK_DISPLAY.md) — Phase 5a shipped; IDE display out of scope

## 1.2.2 — 2026-07-01

### Backend

- Service icons: re-resolve favicon when `iconUrl` exists but the cached file is missing; `/api/services/:id/icon` now retries before 404

## 1.2.0 — 2026-06-29

### Security & OAuth

- OAuth **client secrets** and **access/refresh tokens** stored in macOS Keychain (dev file fallback) — SQLite holds metadata only (`oauth_has_token`, expiry)
- Legacy plaintext tokens migrate automatically on first connect or MCP call; duplicate `Authorization` in `services.headers` stripped
- OAuth reconnect UX: prefill saved Client ID, hide secret field when stored, collapsed Slack first-time steps

### Dashboard

- Deck fan: bounded 10-card viewport, edge-hover scroll, position-based tilt, scroll chevrons, hover lift
- In-deck collection badge styling; deck playbook count fix; reduced service warning spam
- OAuth connect panel improvements

### CLI

- **Agent harness** installer (`agent-deck setup` writes Cursor rules / CLAUDE.md guidance) — see [AGENT_HARNESS.md](docs/AGENT_HARNESS.md)
- Dev vs production data: `npm run dev:all` uses `~/.agent-deck/dev/`; `agent-deck start` uses `~/.agent-deck/`

### Docs

- [SETUP.md](docs/SETUP.md) — secrets & OAuth storage, performance notes
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — secret storage section

## 1.1.7 — 2026-06-29

### Dashboard

- **Fix:** Remote MCP registration headers JSON field was not editable (parse-on-keystroke); now accepts free typing with validation on register
- Updated AgentDeckLogo3 header asset and regenerated `favicon.png` from the new logo

## 1.1.6 — 2026-06-28

### MCP & OAuth

- **Remove** seeded Gmail, Google Calendar, and Google Drive remote cards (BYO GCP too painful); [GOOGLE_DRIVE_WORKAROUND.md](docs/GOOGLE_DRIVE_WORKAROUND.md) documents local stdio path
- **Fix:** GitHub OAuth token exchange (form-urlencoded response from GitHub)
- **Fix:** Fail fast on actionable Streamable HTTP MCP errors instead of masking with SSE 401 fallback (Slack MCP enablement)
- Session-scoped deck binding: `bind_workspace`, `switch_bound_deck`, `get_session_binding` + `x-agent-deck-deck-id` header
- Richer OAuth provider setup guides in connect panel; GitHub guide clarifies Copilot subscription not required for general MCP
- MCP card icon backfill on list/startup for seeded services
- Local MCP import accepts unwrapped server maps, bare `{ command, args }`, and markdown-fenced JSON

### Dashboard

- AgentDeckLogo3 header logo and favicon
- Local MCP setup hints on service details (Google Drive auth is out-of-band, not Agent Deck OAuth)

### CLI

- Published default ports **11111** (API/dashboard) and **11112** (MCP); dev repo stays 8000/3001
- Shared `defaults.ts` for port resolution

### Docs

- MVP, SETUP, PUBLISHING, MCP integration strategy aligned with session bind and Google local path

## 1.1.5 — 2026-06-28

### OAuth & MCP

- **Fix:** Tokens without `expires_at` (Linear, Notion, Slack) no longer show as expired or unauthenticated
- **Fix:** Collection warnings treat a stored OAuth token as sufficient (no `Authorization` header required on the service row)
- **Fix:** Service details modal no longer keeps stale OAuth state from a previously opened service
- OAuth connect panel with provider-specific setup guides (Slack manifest copy, managed vs BYO)
- Managed Slack mode when `AGENT_DECK_SLACK_CLIENT_ID` + `AGENT_DECK_SLACK_CLIENT_SECRET` are set
- Configurable OAuth redirect via `AGENT_DECK_OAUTH_REDIRECT_URI` or `AGENT_DECK_PUBLIC_URL`
- MCP OAuth discovery helpers and connect service refactor

### CLI

- `agent-deck stop` / `agent-deck status` — manage local daemon
- Node **24** recommended; **20+** supported (`node-runtime` checks, clearer doctor messaging)
- Removed `scripts/use-node20.sh`; dev scripts use Node on PATH

### Docs

- [OAUTH_REQUIREMENTS.md](docs/OAUTH_REQUIREMENTS.md) — product OAuth needs, vendor tiers, Slack marketplace, Stytch feasibility
- [OAUTH_AND_HOSTING.md](docs/OAUTH_AND_HOSTING.md) — local vs hosted, HTTPS, Slack paths
- [SLACK_OAUTH_APP.md](docs/SLACK_OAUTH_APP.md) — shared Slack app registration
- [MCP_INTEGRATION_STRATEGY.md](docs/MCP_INTEGRATION_STRATEGY.md) — connection tiers and deferred work
- [SETUP.md](docs/SETUP.md) — Node 24 default policy rewrite
- Slack MCP manifest example: [docs/examples/slack-mcp.manifest.json](docs/examples/slack-mcp.manifest.json)

### Tests

- OAuth session expiry, oauth-manager, oauth-redirect, shared-oauth-apps, provider guides
- MCP Streamable HTTP, PKCE, paths, CLI ports/MCP config
- `rebuild-native.mjs` runs before tests and on `postinstall` so `better-sqlite3` matches active Node

## 1.1.4 — 2026-06-28

### Backend

- **Fix:** SQLite migration for legacy `services` tables missing `is_connected` (indexes now run after migrations)
- **Fix:** Always use `~/.agent-deck/agent_deck.db` — ignore stray `./agent_deck.db` in cwd unless `AGENT_DECK_DB_PATH` is set
- **Fix:** MCP Streamable HTTP for Claude Code — per-client sessions plus GET/DELETE on `/mcp` (1.1.3 used one global session; Claude showed Failed to connect)
- Log database path on backend startup

### CLI

- **Fix:** MCP failure no longer kills the API backend on partial start; reuse existing MCP when port is busy
- `agent-deck debug-mcp` — one-shot MCP connectivity diagnostics

### Tests

- MCP Streamable HTTP integration tests (multi-session initialize, GET `/mcp` SSE)
- DB legacy migration + index tests; CLI MCP config URL tests
- `pre-publish-check` gates `npm publish` and `build:release` — publish aborts if tests fail

## 1.1.3 — 2026-06-28

### CLI

- Fail fast on Node ≠ 20 and on `better-sqlite3` ABI mismatch (stale `~/.npm/_npx` cache)
- Fix `npx` from monorepo cwd resolving workspace backend instead of installed package
- `engines`: Node `>=20 <21`

## 1.1.2 — 2026-06-28

### CLI

- **Fix:** `npx @agent-deck/cli start` — bin shim resolved wrong path (`node_modules/dist` instead of `@agent-deck/cli/dist`); server never started
- Upgrade `better-sqlite3` 9 → 12 (Node 20–24 prebuilds; no API changes in Agent Deck)
- `agent-deck stop` / `agent-deck status` — manage the local daemon
- `agent-deck start --force` — restart if already running
- Detect port conflicts with clear errors; reuse existing instance instead of double-starting
- Claude setup fallback writes `~/.claude.json` (not `settings.json`)
- Dashboard URL docs: npm uses **:8000**; OAuth redirect follows bundled UI (not hardcoded :3000)

## 1.1.1 — 2026-06-28

### CLI

- `agent-deck setup --client cursor|claude|claude-desktop` — write MCP client config (merge-safe)
- `agent-deck upgrade` / `--check` — npm version check and global reinstall
- Update notification on `start` (24h cache); `AGENT_DECK_AUTO_UPGRADE=1` for silent upgrade

## 1.1.0 — 2026-06-27

### Distribution

- Publishable npm packages: `@agent-deck/cli`, `@agent-deck/backend`, `@agent-deck/shared`
- CLI npm name is `@agent-deck/cli` (bin remains `agent-deck`; unscoped `agent-deck` was rejected by npm as too similar to `agentdeck`)
- `agent-deck start` — single command for backend, dashboard UI, and MCP server
- `agent-deck doctor` and `agent-deck --version`
- MCP Registry metadata in `server.json`
- Release scripts: `npm run build:release`, `npm run version:sync`, `npm run publish:packages`

### Agent & dashboard (from prior work on main)

- Agent MCP tools for collection CRUD and bound-deck linking
- Dashboard: MCP tool toggles, credential details, health status, collection warnings

## 1.0.0

- MVP Modules 1–3: vault, playbooks, repo deck binding, collection warnings
