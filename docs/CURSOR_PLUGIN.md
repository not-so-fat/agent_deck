# Cursor Plugin & Marketplace

Agent Deck includes a Cursor plugin in [`plugin/`](../plugin/).

## What's included

| Component | Path | Purpose |
|-----------|------|---------|
| Manifest | `plugin/.cursor-plugin/plugin.json` | Plugin metadata for marketplace |
| MCP config | `plugin/mcp.json` | Points to `http://127.0.0.1:3001/mcp` |
| Skill | `plugin/skills/agent-deck/SKILL.md` | Teaches agent to use decks and MCP App |

## Try locally

1. Start Agent Deck:

```bash
npm run dev:all
```

2. Add MCP manually (fastest):

Create or edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "agent-deck": {
      "url": "http://127.0.0.1:3001/mcp"
    }
  }
}
```

3. In Cursor chat, ask: **"Show my Agent Deck"**

## Submit to Cursor Marketplace

1. Copy logo: `misc/AgentDeckLogo2.png` → `plugin/assets/logo.png`
2. Review [Cursor plugin docs](https://cursor.com/docs/plugins)
3. Submit at [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish)
4. Point submission to the `plugin/` directory (or a dedicated plugin repo)

### Submission checklist

- [ ] Plugin manifest validates (`name`, `description`, `keywords`)
- [ ] MCP server URL documented — user must run local daemon first
- [ ] Skill covers `show_agent_deck`, deck switching, dashboard link
- [ ] README explains Node 20 + `npm run dev:all` prerequisite
- [ ] Tested on Cursor 2.6+ with MCP Apps

## Project-level MCP config

For contributors cloning this repo, `.cursor/mcp.json` at the repo root pre-configures Agent Deck when the daemon is running.
