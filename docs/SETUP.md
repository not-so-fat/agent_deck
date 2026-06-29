# Agent Deck — Setup Guide

Canonical install and environment reference. For OAuth / hosting / Slack confusion, start with **[OAUTH_AND_HOSTING.md](./OAUTH_AND_HOSTING.md)**.

## Prerequisites

- **Git**
- **npm** (comes with Node)
- **Node.js 24** (typical OS default) or **Node 20+** — see below

## Node.js version policy

| | |
|--|--|
| **Default (use this)** | **Node 24.x** — current OS / Homebrew / nvm default on new machines |
| **Minimum supported** | Node **20.0.0** (`engines` in all packages) |
| **Also supported** | 20, 22, 23, 24, 25, 26 (with matching `better-sqlite3` build) |
| **Optional nvm hint** | `.nvmrc` → `24` (only if you use nvm; **not** a downgrade to 20) |

Agent Deck does **not** require Node 20. We upgraded `better-sqlite3` (v12+) so current Node releases work with prebuilds. **Node 24 is what we develop and test against first** because that is what users already have.

### Check your version

```bash
node -v
```

- `v24.x.x` — expected default; no action needed
- `v20.x.x` — supported; run `npm install` on that version
- Anything below 20 — upgrade Node

### nvm users (optional)

If you use nvm and want the repo’s suggested version:

```bash
cd agent_deck
nvm install    # reads .nvmrc → 24
nvm use
node -v
```

If you already have Node 24 from the OS, **you do not need nvm or `.nvmrc`**.

### Native module mismatch

`better-sqlite3` is compiled for the Node version active during `npm install`. If you switch Node major versions, tests and the backend can fail with `NODE_MODULE_VERSION … was compiled against a different Node.js version`.

**Automatic:** `npm install` and `npm run test` run `scripts/rebuild-native.mjs` to recompile `better-sqlite3` for the current Node.

**Manual fix:**

```bash
npm rebuild better-sqlite3
# or: rm -rf node_modules && npm install
```

### Production / hosted backend

Use **Node 24** (`node:24-alpine` or current LTS on your host). Node 20 remains valid if your infra pins it — run the same install/rebuild on that runtime.

---

## Quick start (from source)

```bash
git clone https://github.com/not-so-fat/agent_deck.git
cd agent_deck
node -v    # v24.x recommended
npm install
npm run build
npm run dev:all
```

| Service | URL |
|---------|-----|
| Dashboard (dev) | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| MCP | http://127.0.0.1:3001/mcp |

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:3001/backend-status
```

## Quick start (npm / end users)

```bash
npx @agent-deck/cli@latest setup --client cursor --start
# Dashboard → http://127.0.0.1:11111  (not :3000; dev repo uses :8000 / :3000)
```

See [PUBLISHING.md](./PUBLISHING.md) and [README](../README.md).

## Ports

Two installs can run on the same machine without clashing:

| Mode | Backend | MCP | Dashboard |
|------|---------|-----|-----------|
| **Dev repo** (`npm run dev:all`) | 8000 | 3001 | http://localhost:3000 |
| **CLI / npx** (`agent-deck start`) | **11111** | **11112** | http://127.0.0.1:11111 |

Override CLI ports: `AGENT_DECK_PORT`, `AGENT_DECK_MCP_PORT`.

OAuth redirect URI follows the backend you use (e.g. dev → `http://127.0.0.1:8000/api/oauth/callback`, npx → `http://127.0.0.1:11111/api/oauth/callback`). Both share `~/.agent-deck` data.

Legacy reference:

| Port | Service |
|------|---------|
| 3000 | Vite frontend (**dev only**, `npm run dev:all`) |
| 8000 | Backend API (**dev repo**) |
| 3001 | MCP server (**dev repo**) |
| 11111 | Backend + bundled UI (**npx / CLI**) |
| 11112 | MCP server (**npx / CLI**) |

```bash
agent-deck status
agent-deck stop
agent-deck start --force
```

## Environment variables

### Core

| Variable | Purpose |
|----------|---------|
| `PORT` | Backend port (default `8000`) |
| `HOST` | Bind address |
| `NODE_ENV` | `development` / `production` |
| `AGENT_DECK_DB_PATH` | SQLite path override |

### OAuth redirect (see [OAUTH_AND_HOSTING.md](./OAUTH_AND_HOSTING.md))

| Variable | Purpose |
|----------|---------|
| `AGENT_DECK_OAUTH_REDIRECT_URI` | Full callback URL override |
| `AGENT_DECK_PUBLIC_URL` | HTTPS origin → `{url}/api/oauth/callback` |
| `AGENT_DECK_DASHBOARD_URL` | Where to send browser after OAuth |

### Shared provider apps (maintainers)

| Variable | Purpose |
|----------|---------|
| `AGENT_DECK_SLACK_CLIENT_ID` | Agent Deck–owned Slack app |
| `AGENT_DECK_SLACK_CLIENT_SECRET` | Slack client secret (never commit) |

## Common issues

### NODE_MODULE_VERSION / better-sqlite3

You changed Node major after `npm install`:

```bash
npm rebuild better-sqlite3 -w @agent-deck/backend
```

### Port in use

```bash
agent-deck stop
```

### Slack distribution requires HTTPS

[SLACK_OAUTH_APP.md](./SLACK_OAUTH_APP.md) — set `AGENT_DECK_PUBLIC_URL` on your hosted backend.

## Development commands

```bash
npm run dev:all
npm test
npm run build
```

## Documentation map

| Guide | When to read |
|-------|----------------|
| [OAUTH_AND_HOSTING.md](./OAUTH_AND_HOSTING.md) | Slack, HTTPS, local vs hosted |
| [USER_GUIDE.md](./USER_GUIDE.md) | Using the dashboard |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Contributing |
| [SLACK_OAUTH_APP.md](./SLACK_OAUTH_APP.md) | Shared Slack app |
