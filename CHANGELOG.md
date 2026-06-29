# Changelog

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
