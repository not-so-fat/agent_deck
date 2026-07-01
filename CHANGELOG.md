# Changelog

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
