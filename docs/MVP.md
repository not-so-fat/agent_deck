# Agent Deck MVP — Development Spec

**Status:** Active  
**Vision / future reference:** [Agent Deck v2](file:///Users/not_so_fat/workspace/Obsidian/lexicon-personal/Ideas/personal/Agent%20Deck%20v2.md) (Obsidian) — full card model, API profiles, workflow tiers, modular roadmap Modules 4–5.

**Goal:** Ship **Modules 1–3** on top of v1 (MCP proxy + decks). Prove unconscious scoping, centralized API keys, and reusable playbooks.

---

## MVP delivers

| Module | Feature | User outcome |
|--------|---------|--------------|
| **1. Scope** | Repo `.agent-deck/deck.yaml` + auto-activate | Open workspace → correct deck, no MCP reconfig |
| **2. Vault** | Credentials in Keychain + `agent-deck exec` | One place for API keys; scripts run without `.env` |
| **3. Playbooks** | Markdown playbooks + MCP `list_playbooks` / `get_playbook` | Repeat procedures without re-explaining in chat |

**Explicitly out of MVP scope** (see vision doc): API profile catalog, `call_api`, workflow manifest runner, save-from-chat extractor, progressive tool discovery, session phases.

**In MVP:** API keys via **Credential** cards and env injection — not deferred.

---

## Non-goals (MVP)

- Replacing Cursor skill loading mechanism
- Running or bundling third-party CLIs (only wrap via `exec`)
- Cloud sync / multi-user
- Breaking v1 MCP proxy behavior

---

## Architecture (MVP)

```
┌─────────────────────────────────────────────────────────┐
│  Agent host (Cursor)                                     │
│    └── MCP → localhost:3001/mcp (unchanged entrypoint)   │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  Agent Deck                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │ Deck scope  │  │ Vault        │  │ Playbooks     │ │
│  │ (v1 + yaml) │  │ (Keychain)   │  │ (.md files)   │ │
│  └─────────────┘  └──────────────┘  └───────────────┘ │
│  ┌─────────────┐  ┌──────────────┐                     │
│  │ MCP proxy   │  │ CLI: exec    │                     │
│  │ (v1)        │  │              │                     │
│  └─────────────┘  └──────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

---

## Module 1 — Scope

### Repo deck manifest

```yaml
# .agent-deck/deck.yaml (in user project repo)
id: deck_example
name: Example Project
# Maps to existing Agent Deck deck id OR inline service list (TBD in impl)
deck_id: "<uuid-from-dashboard>"   # option A: link to DB deck
# option B (later): inline mcp_services + credentials + playbooks

playbooks:
  - playbooks/weekly-status.md

credentials:
  - cred_openai   # refs registered in ~/.agent-deck/ or global store

inherit: personal-default   # optional ~/.agent-deck/decks/personal-default.yaml
```

### Behavior

1. On MCP `initialize` or dedicated tool, client may pass workspace root (or user sets in dashboard).
2. If `.agent-deck/deck.yaml` exists → activate linked deck (or merge playbook/credential refs).
3. Fallback: last active deck (v1 behavior).

### Deliverables

- [ ] Schema for `.agent-deck/deck.yaml`
- [ ] Backend: resolve manifest, activate deck
- [ ] Dashboard: optional “export deck to repo” helper
- [ ] Docs: convention for monorepo vs global default

---

## Module 2 — Vault (API keys)

### Credential model (MVP)

Single card type — no separate Secret entity in UI (Keychain is storage backend).

```yaml
# ~/.agent-deck/credentials/cred_ashby.yaml (metadata only)
id: cred_ashby
label: Ashby API
scheme: http_basic_user    # bearer | header | http_basic_user
header_name: null          # for scheme: header
env_name: ASHBY_API_KEY    # injected by exec
tags: [hiring]
```

Value stored in **macOS Keychain** (service: `agent-deck`, account: `cred_ashby`). SQLite holds metadata only.

### Migration from v1

- Existing `services.headers` with `Authorization` → extract to Credential + Keychain on upgrade.
- MCP services reference `credential_id` instead of inline headers (optional field on Service).

### CLI: `agent-deck exec`

```bash
agent-deck exec \
  --deck <deck-id|manifest-path> \
  --connections cred_ashby,cred_openai,cred_slack \
  [--dry-run] \
  -- <command...>
```

Behavior:

1. Resolve each credential → fetch from Keychain.
2. Build env map from `env_name` → value.
3. Spawn child with inherited env + injected vars (never print secrets).
4. Log credential **ids** used (audit), not values.

Subcommands (MVP):

```bash
agent-deck credential add cred_ashby --env-name ASHBY_API_KEY --scheme http_basic_user
agent-deck credential list
agent-deck credential rotate cred_ashby   # prompt for new value
```

### Deliverables

- [ ] Keychain adapter (macOS first; Linux secret-service later)
- [ ] Credential CRUD API + dashboard UI
- [ ] `packages/cli` or `apps/agent-deck-cli` with `exec` subcommand
- [ ] Migrate v1 header storage
- [ ] Tests: exec injects env; agent MCP cannot read raw values

---

## Module 3 — Playbooks

### Format

Markdown with YAML frontmatter. Lives in **user repo** (`.agent-deck/playbooks/`) or global `~/.agent-deck/playbooks/`.

```markdown
---
id: hiring-inbox
triggers:
  - check inbox
  - review applicants
connections:
  - cred_ashby
  - cred_openai
  - cred_slack
exec: "uv run hiring inbox --dry-run"   # optional; documented for agent/user
skill: .claude/skills/hiring/SKILL.md   # optional path hint
---

# Hiring inbox

1. Run the hiring CLI via Agent Deck exec (connections above).
2. Walk results worst-tier first; user confirms each write.
3. Do not skip `--dry-run` until user says otherwise.

Domain calibration lives in repo `roles/` — not duplicated here.
```

### MCP tools (add to `:3001/mcp`)

| Tool | Args | Returns |
|------|------|---------|
| `list_playbooks` | — | Playbooks in active deck (id, triggers, path) |
| `get_playbook` | `playbook_id` | Full markdown body + frontmatter |

No `run_playbook` executor in MVP — agent reads content and follows steps (or user runs `exec` line manually / via agent shell).

### Deck linkage

`.agent-deck/deck.yaml` lists playbook paths. Active deck merge:

- v1 MCP services (from DB deck)
- credential refs (for exec)
- playbook paths (filesystem)

### Deliverables

- [ ] Frontmatter parser
- [ ] MCP tools `list_playbooks`, `get_playbook`
- [ ] Dashboard: view playbooks referenced by deck
- [ ] Example playbooks in `docs/examples/`

---

## Reference integration — hiring CLI (Ashby)

Dogfood target for Modules 2–3. External repo: `ashby-triage` (local Python CLI).

### Connection map

| Credential | env var | Used by |
|------------|---------|---------|
| `cred_ashby` | `ASHBY_API_KEY` | Ashby REST (HTTP Basic) |
| `cred_openai` | `OPENAI_API_KEY` | LLM triage |
| `cred_slack` | `SLACK_BOT_TOKEN` | Post decisions |

No MCP for Ashby — validates **API key + exec** path.

### Target layout (in ashby-triage repo, not agent_deck)

```
ashby-triage/
  .agent-deck/
    deck.yaml
    playbooks/
      hiring-inbox.md
      hiring-feedback.md
  roles/              # unchanged — user's domain logic
  .claude/skills/hiring/SKILL.md
```

### MVP validation commands

```bash
# Register creds once (global store)
agent-deck credential add cred_ashby --env-name ASHBY_API_KEY --scheme http_basic_user
agent-deck credential add cred_openai --env-name OPENAI_API_KEY --scheme bearer
agent-deck credential add cred_slack --env-name SLACK_BOT_TOKEN --scheme bearer

# Run without .env
cd ashby-triage
agent-deck exec --connections cred_ashby,cred_openai,cred_slack -- \
  uv run hiring inbox --dry-run
```

### Agent path (Module 3)

1. Deck includes hiring playbooks + cred refs.
2. User: “Check hiring inbox.”
3. Agent: `get_playbook(hiring-inbox)` → follows steps → suggests `agent-deck exec …`.

### Future (Module 4–5, vision doc only)

- API profile `api_ashby` with endpoint catalog
- Workflow card Tier 2 binding CLI permanently
- Manifest for confirm loops / SQLite cache

---

## Implementation order

1. **Module 2 first** (vault + exec) — immediate value, unblocks hiring dogfood.
2. **Module 1** (repo deck yaml) — can parallelize; links creds + playbooks to workspace.
3. **Module 3** (playbooks + MCP tools) — completes repeatability story.

Suggested branches:

- `feat/vault-exec`
- `feat/repo-deck-manifest`
- `feat/playbooks`

---

## Success criteria

- [ ] Open `agent_deck` repo in Cursor → v1 still works unchanged.
- [ ] Register 3 credentials; run hiring CLI via `exec` with no `.env`.
- [ ] Playbook markdown referenced in deck; agent retrieves via `get_playbook`.
- [ ] No secret values in SQLite, MCP responses, or logs.
- [ ] README section pointing to this doc + vision doc.

---

## Open decisions (resolve during impl)

| Question | Options | Lean |
|----------|---------|------|
| Deck yaml links DB deck vs inline services | `deck_id` vs full inline | **`deck_id`** — reuse v1 dashboard |
| Credential store path | `~/.agent-deck/` vs DB only | **`~/.agent-deck/credentials/`** yaml + Keychain |
| Linux vault | Keychain vs libsecret | macOS first; stub Linux |
| CLI package location | root bin vs `packages/cli` | **`packages/cli`** |

---

## Related docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — v1 system
- [DEVELOPMENT.md](./DEVELOPMENT.md) — run locally
- [MCP_APP.md](./MCP_APP.md) — in-chat UI
- Vision: Agent Deck v2 (Obsidian) — API profiles, three scenarios, Modules 4–5
