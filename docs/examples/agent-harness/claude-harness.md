<!-- Merged into ~/.claude/CLAUDE.md by `agent-deck setup` (between agent-deck:harness markers) -->

## Agent Deck

Before declining for missing tools (Slack, Linear, GitHub, etc.), use agent-deck MCP: `bind_workspace`, `list_bound_deck_services`, `call_service_tool`. Don't hardcode deck IDs.

Deck playbooks are task recipes — `list_playbooks` / `get_playbook` (match `triggers`). Don't mirror into `.cursor/skills/`. Feedback on playbook output → fix the artifact, then `update_playbook` (generalize; show what changed).
