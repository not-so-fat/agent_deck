# Publishing Agent Deck

## Packages

| npm package | Purpose |
|-------------|---------|
| `@agent-deck/shared` | Types and schemas |
| `@agent-deck/backend` | API, MCP server, SQLite, vault (includes bundled dashboard in `static-ui/`) |
| `@agent-deck/cli` | CLI — `start`, `doctor`, `credential`, `exec` (bin: `agent-deck`) |

Publish **in order**: shared → backend → cli.

## Prerequisites

- Node.js **24** (or **20+**) on the publish machine ([SETUP.md](./SETUP.md#nodejs-version-policy))
- npm account with access to publish `@agent-deck/*` (create the [npm org](https://www.npmjs.com/org/create) if needed)
- Logged in: `npm login`

## Version bump

```bash
# Set all package.json + server.json to the same semver
npm run version:sync -- 1.2.0

npm install
npm run build:release
```

Update `CHANGELOG.md`, then commit.

## Git tags & GitHub releases

Tag every npm release so `git checkout v1.2.1` matches what shipped.

| Tag format | Example |
|------------|---------|
| Annotated git tag | `v1.2.1` (matches root `package.json` / npm) |
| Points at | The `Ship X.Y.Z: …` commit on `main` |

### After publish

```bash
# Tag current HEAD (reads version from package.json) and push
npm run release:tag:push

# Optional: GitHub Release with CHANGELOG section for this version
node scripts/release-tag.mjs --push --github-release
```

### One-time backfill (older releases)

```bash
npm run release:tag:backfill
```

Scans `git log` for `Ship 1.2.1:` / `… at 1.1.5` subjects and tags those commits. Skips tags that already exist.

### Manual

```bash
git tag -a v1.2.1 -m "Agent Deck 1.2.1"
git push origin v1.2.1
gh release create v1.2.1 --title "1.2.1" --notes-file .temporal/logs/release-notes-1.2.1.md
```

## Dry run (local)

```bash
npm run build:release
npx @agent-deck/cli doctor
npx @agent-deck/cli start --open
```

Dashboard: `http://127.0.0.1:11111`  
MCP: `http://127.0.0.1:11112/mcp`

Dev repo (`npm run dev:all`) uses `:8000` / `:3001` so both can run together — see [SETUP.md](./SETUP.md#ports).

## Publish to npm

Tests must pass first (`npm test`). Publish is blocked if any workspace test fails.

```bash
npm run publish:packages
npm run release:tag:push
```

Optional GitHub Release notes from `CHANGELOG.md`:

```bash
node scripts/release-tag.mjs --push --github-release
```

This runs the full test suite, `build:release`, then publishes shared → backend → cli.

Or step by step:

```bash
npm run build:release
npm publish -w @agent-deck/shared --access public
npm publish -w @agent-deck/backend --access public
npm publish -w @agent-deck/cli --access public
```

The `@agent-deck/cli` package sets `mcpName` to match `server.json` for MCP Registry verification.

## MCP Registry

After npm publish:

1. Install [mcp-publisher](https://modelcontextprotocol.io/registry/quickstart)
2. Authenticate (GitHub namespace for `io.github.not-so-fat/agent-deck`)
3. Publish `server.json` from repo root

Users still run **`npx @agent-deck/cli start`** locally — the registry entry documents the HTTP MCP endpoint. After install, the command is still **`agent-deck`**.

## End-user install (Claude Code)

```bash
npx @agent-deck/cli setup --client claude --start
```

Or step by step:

```bash
npx @agent-deck/cli start
```

```bash
claude mcp add --scope user --transport http agent-deck http://127.0.0.1:11112/mcp
```

### MCP client setup

| Client | Command |
|--------|---------|
| Cursor (global) | `agent-deck setup --client cursor` |
| Cursor (project) | `agent-deck setup --client cursor --scope project` |
| Claude Code | `agent-deck setup --client claude` (uses `claude mcp add` → `~/.claude.json`; fallback writes same file — **not** `settings.json`) |
| Claude Code (project) | `agent-deck setup --client claude --scope project` → `.mcp.json` |
| Claude Desktop | `agent-deck setup --client claude-desktop` (stdio bridge via supergateway) |

Add `--start` to launch Agent Deck after writing config.

### Auto-upgrade

| Command / env | Behavior |
|---------------|----------|
| `agent-deck upgrade` | Fetch latest from npm and `npm install -g @agent-deck/cli@latest` |
| `agent-deck upgrade --check` | Show if an update exists |
| `AGENT_DECK_AUTO_UPGRADE=1` | On `start`, upgrade before launching (global install) |
| (default on `start`) | Once per 24h, notify if a newer version is on npm |
| `AGENT_DECK_NO_UPDATE_CHECK=1` | Disable update notification on start |

`npx @agent-deck/cli@latest` always resolves latest from npm; auto-upgrade helps **global** installs stay current.

Optional env:

| Variable | Default | Purpose |
|----------|---------|---------|
| `AGENT_DECK_PORT` | `11111` | API + dashboard (dev repo uses `8000`) |
| `AGENT_DECK_MCP_PORT` | `11112` | MCP HTTP endpoint (dev repo uses `3001`) |
| `AGENT_DECK_HOME` | `~/.agent-deck` | Database and credential metadata |

## Development vs published

| Mode | Command | Dashboard |
|------|---------|-----------|
| **Dev** (hot reload) | `npm run dev:all` | `http://localhost:3000` (Vite proxy) |
| **Published / release** | `npx @agent-deck/cli start` | `http://127.0.0.1:11111` (bundled static UI) |
