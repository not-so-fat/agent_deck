# Agent Deck — Cursor Plugin

Cursor plugin for [Agent Deck](https://github.com/not-so-fat/agent_deck): a local MCP proxy with deck-based context switching and an optional MCP App UI.

## What this plugin adds

- **MCP server config** → `http://127.0.0.1:3001/mcp`
- **Skill** → helps the agent use `show_agent_deck`, switch decks, and open the dashboard

## Install (local development)

1. Start Agent Deck from the repo root:

```bash
npm run dev:all
```

2. Install this plugin locally — copy or symlink `plugin/` into your Cursor plugins path, or submit to the [Cursor Marketplace](https://cursor.com/marketplace/publish).

3. In Cursor: **Settings → Tools & MCP** → connect the **agent-deck** server.

4. Ask: **"Show my Agent Deck"**

## Marketplace submission

Submit the `plugin/` directory at [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish).

Before submitting:
- [ ] Agent Deck daemon instructions are clear in the skill
- [ ] Logo at `plugin/assets/logo.png` (copy from `misc/AgentDeckLogo2.png`)
- [ ] Test with Cursor 2.6+ MCP Apps support
