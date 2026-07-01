<!-- Merged into ~/.claude/CLAUDE.md by `agent-deck setup` (between agent-deck:harness markers) -->

## Agent Deck

Before declining for missing tools (Slack, Linear, GitHub, etc.), use agent-deck MCP: `bind_workspace`, `list_bound_deck_services`, `call_service_tool`. Don't hardcode deck IDs.

Deck playbooks are task recipes — `list_playbooks` / `get_playbook` (match `triggers`). Don't mirror into `.cursor/skills/` — one source of truth on the deck.

### Playbooks — refine from outcomes (self-improvement)

**When:** The user gives feedback on output you produced while following a bound-deck playbook — you called `get_playbook` this session and used its body/steps for that artifact. Use that session trace to identify the playbook; don't infer from playbook title, filename, or output type alone.

**Do both (default):**
1. Fix the **current output** per the user's feedback.
2. Call `update_playbook` on that same playbook so the **next** run avoids repeating the mistake.

**How to update the playbook:**
- **Generalize** — drop project-specific names, paths, and schemas; the playbook is reusable practice
- **Place the lesson** — checklist item for verification, technique for positive patterns, anti-pattern for mistakes to avoid
- **Restructure** if the playbook can't absorb the lesson cleanly — don't bolt it on
- **Surface the change** in your response so the user can audit drift
