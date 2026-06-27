# Publish to the MCP Registry

This guide covers publishing Agent Deck metadata to the [official MCP Registry](https://modelcontextprotocol.io/registry/about).

The registry lists **metadata** (name, description, install instructions) — not your local daemon. Users still run Agent Deck locally and connect to `http://127.0.0.1:3001/mcp`.

## Prerequisites

1. **npm package** — publish `@not-so-fat/agent-deck` (or your scoped name) to npm
2. **GitHub account** — for `io.github.not-so-fat/agent-deck` namespace auth
3. **`mcpName` in package.json** — must match `server.json` `name`

## Step 1: Publish npm package

Before registry publish, ship a CLI or launcher on npm. Example `package.json` fields:

```json
{
  "name": "@not-so-fat/agent-deck",
  "version": "1.0.0",
  "mcpName": "io.github.not-so-fat/agent-deck",
  "bin": {
    "agent-deck": "./bin/agent-deck.js"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/not-so-fat/agent_deck.git"
  }
}
```

> **Status:** npm publish is planned (see README Future Plan). `server.json` in the repo root is ready; update `packages[].identifier` and `version` when the npm package ships.

## Step 2: Edit server.json

The repo includes `server.json` at the project root. Update:

- `name` — must match `mcpName` in npm package
- `packages[].identifier` — your npm package name
- `packages[].version` — published npm version
- `description`, `icons`, `websiteUrl`

## Step 3: Install mcp-publisher

```bash
brew install mcp-publisher
# or download from https://github.com/modelcontextprotocol/registry/releases
```

## Step 4: Authenticate

```bash
mcp-publisher login github
```

## Step 5: Publish

From the repo root (where `server.json` lives):

```bash
mcp-publisher publish
```

## Verify

```bash
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=agent-deck"
```

## Notes

- The registry does **not** support private localhost-only servers as remote endpoints; listing describes how to **install and run** locally.
- Transport in `server.json` documents the default local URL after `npm run dev:all`.
- For automated releases, see [GitHub Actions publishing](https://modelcontextprotocol.io/registry/github-actions).
