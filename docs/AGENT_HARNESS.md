# Agent harness (CLAUDE.md & Cursor rules)

**Audience:** Agent Deck users on Claude Code or Cursor  
**Status:** Installed automatically by `agent-deck setup`  
**Related:** [PLAYBOOKS_AND_SKILLS.md](./PLAYBOOKS_AND_SKILLS.md), [examples/agent-harness/](./examples/agent-harness/)

Agent Deck exposes **tools** (MCP). Your agent’s **control plane** (`CLAUDE.md`, `.cursor/rules/`) teaches *how* to use them. Setup treats the harness as a **required install step** alongside MCP config — Agent Deck can run without it, but the intended workflow always installs it.

---

## What `setup` installs

| Client | Scope | File |
|--------|-------|------|
| **Cursor** | global (default) | `~/.cursor/rules/agent-deck.mdc` |
| **Cursor** | project | `.cursor/rules/agent-deck.mdc` |
| **Claude Code** | global | `~/.claude/CLAUDE.md` (merged between `agent-deck:harness` markers) |
| **Claude Code** | project | `./CLAUDE.md` (same merge) |
| **Claude Desktop** | — | MCP only; use Claude Code/Cursor harness if you use those too |

```bash
npx @agent-deck/cli setup --client cursor    # MCP + global harness
npx @agent-deck/cli setup --client claude   # MCP + global harness
npx @agent-deck/cli setup --client cursor --scope project   # project MCP + project harness
```

Re-running `setup` **updates** the harness in place (idempotent).

### Safety — we do not replace your other rules or skills

| What | Behavior |
|------|----------|
| **Other Cursor rules** (`~/.cursor/rules/*.mdc`) | **Never read or written** — only `agent-deck.mdc` |
| **Cursor skills** (`.cursor/skills/`, `~/.cursor/skills/`) | **Never touched** |
| **Claude `CLAUDE.md`** | **Merge only** — appends an `agent-deck:harness` block, or replaces **only** that block on re-setup; your other sections stay |
| **`agent-deck.mdc`** | Merge like CLAUDE.md — custom frontmatter and notes outside the harness markers are kept |

Add your own notes above/below the harness markers in `agent-deck.mdc`, or anywhere in `CLAUDE.md` outside the markers.

---

## Re-running `setup` or upgrading

| Action | MCP config | Harness | Your other rules / CLAUDE.md |
|--------|------------|---------|------------------------------|
| **`setup` again (same version)** | Re-merges `mcpServers.agent-deck` only; other MCP entries kept | **No-op** if template unchanged (`already current`); otherwise updates **only** the marked harness block | Untouched |
| **`setup` after editing harness by hand** | Same as above | Re-run **overwrites** text between `agent-deck:harness` markers with the stock template; your notes **outside** markers stay | Untouched |
| **`agent-deck upgrade`** | **Not run** — only replaces the global npm CLI package | **Not run** — run `setup` again if a release ships new harness wording | Untouched |
| **`npx @agent-deck/cli@latest setup`** | Updates `agent-deck` URL if host/port changed | Refreshes harness if the new CLI ships updated template text | Untouched |

**Data:** decks, collection, and credentials in `~/.agent-deck/` are separate from setup; upgrade does not reset them.

**Claude Code:** if `claude mcp add` succeeds, MCP is registered via the CLI (second run is usually harmless). If the CLI fails, setup falls back to merging `~/.claude.json` like Cursor.

---

## Harness content (compact)

One short rule block — skill-description density, no project-specific examples:

1. **Capability rescue** — use agent-deck before declining tool requests  
2. **Playbooks** — `list_playbooks` / `get_playbook`; don’t mirror into `.cursor/skills/`  
3. **Feedback loop** — `update_playbook` after fixing playbook output  

**Project scope** adds: bind this repo’s workspace root; prefer deck playbooks before improvising.

Templates: [cursor-agent-deck.mdc](./examples/agent-harness/cursor-agent-deck.mdc), [claude-harness.md](./examples/agent-harness/claude-harness.md).

---

## Manual edit / audit

- **Cursor:** edit `agent-deck.mdc`; `description` in frontmatter is what the rule picker shows (like a skill one-liner).  
- **Claude:** edit the `## Agent Deck` section between `<!-- agent-deck:harness:start/end -->` markers so `setup` can refresh without clobbering your other CLAUDE.md notes.  
- **Customize:** edit the file after setup; re-run `setup` only when you want the stock template refreshed.

---

## What Agent Deck does *not* do

- **No harness over MCP** — `bind_workspace` does not replace CLAUDE.md or Cursor rules.  
- **No auto-sync to skills** — playbooks stay on the deck; the harness points the agent at MCP.
