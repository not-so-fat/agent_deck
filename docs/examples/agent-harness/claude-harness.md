<!-- Merged into ~/.claude/CLAUDE.md by `agent-deck setup` (between agent-deck:harness markers) -->

## Agent Deck

**Connect first:** Ensure Agent Deck MCP is connected before using deck tools (`agent-deck setup --client cursor|claude --start`, then restart the host). Claude Code: `claude mcp list` should show agent-deck as Connected when the backend is running.

**Session opener (first turn only):** When Agent Deck MCP is connected and this is a new conversation in a workspace, call `bind_workspace` with the project root (use `get_repo_deck_status` first if `.agent-deck/deck.yaml` may be missing), then `get_session_binding`, and tell the user **exactly one line** using `display_summary` (e.g. `◆ dev · 2 MCP · 0 keys · 1 playbooks`). This is the deck-status line for IDE Agent chat — there is no host footer there. Do **not** repeat it every turn unless the user asks or the bind changes (`switch_bound_deck`, new repo).

**Later turns:** Call `bind_workspace` before the first deck-scoped tool if not already bound. Terminal hosts may also show the deck in the prompt footer via `statusLine`; do not duplicate unless the user asks.

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
