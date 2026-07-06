# ADR — Installation must make Agent Deck unavoidable

**Status:** Superseded (partial) — `deck.yaml` / Layer 2 bind model was not shipped; **session binding** (`bind_workspace`) is as-built per [MVP.md](../MVP.md). Retained as historical incident + design notes.  
**Date:** 2026-06-30  
**Context:** Agent bypassed Agent Deck when drafting PRDs — read `~/.agent-deck/agent_deck.db` via `sqlite3` instead of `get_playbook` on MCP.

---

## Incident (what happened)

1. User asked for PRDs; agent had **user-agent-deck** MCP enabled.
2. `bind_workspace` **failed** — no `.agent-deck/deck.yaml` in `agent_deck` repo.
3. Playbook list on MCP returned **empty** (then `list_playbooks`; now `get_bound_deck`) — Cursor MCP hit **dev** backend (`:3001` → `~/.agent-deck/dev/`), while PRD playbooks live on **production** deck `dev` (`~/.agent-deck/`, 2 playbooks).
4. Agent **fallback**: direct SQLite read of production DB — full bypass of MCP, binding, and audit trail.

---

## Root causes

| Gap | Effect |
|-----|--------|
| **Two data worlds** | `npm run dev:all` → `~/.agent-deck/dev/`; `agent-deck start` / npx → `~/.agent-deck/`. Same deck name `dev`, different UUIDs and content. |
| **Setup = MCP URL + harness only** | No `deck.yaml`, no playbook seed, no bind, no port profile for monorepo dev. |
| **Harness is soft** | Says playbooks exist; does not **require** `get_playbook` before matching tasks or forbid filesystem/DB bypass. |
| **Dogfooding gap** | `agent_deck` repo has no committed `.agent-deck/deck.yaml`, no project `.cursor/mcp.json` for dev ports. |
| **Playbook discoverability** | Skills auto-load; playbooks need `get_bound_deck` / `get_playbook` after successful bind — extra steps with failure modes. |
| **No “doctor” for agent path** | `agent-deck doctor` does not verify bind → playbooks reachable for cwd. |

---

## Design goal

**If Agent Deck is installed, agents must not have a reasonable path around it** for deck-scoped knowledge (playbooks, bound MCPs, credentials metadata).

Users may still use git docs — but playbook cards should be the **mandated** path when triggers match.

---

## Proposed installation model (4 layers)

Today `setup` only does **Layer 1**. Layers 2–4 are missing.

```
Layer 1 — Transport     MCP config + harness          (shipped)
Layer 2 — Workspace   deck.yaml + bind contract       (superseded — use session binding; see MVP + MONOREPO_SCOPE)
Layer 3 — Content     playbooks on bound deck         (manual / split brain)
Layer 4 — Verify      doctor checks agent can read PB   (missing)
```

### Layer 1 — Transport (keep, extend)

```bash
# End users (unchanged default)
agent-deck setup --client cursor --start

# Monorepo / agent_deck repo (NEW profile)
agent-deck setup --client cursor --scope project --profile dev
# Writes .cursor/mcp.json → :3001, harness in .cursor/rules/, deck.yaml stub
```

`--profile dev` sets `AGENT_DECK_DEV=1` hint in generated docs and uses MCP port **3001** + backend **8000**.

### Layer 2 — Workspace bind (superseded — not shipped)

> **Superseded:** The `deck.yaml` model below was not shipped. As-built binding uses **`bind_workspace`** per session — see [MVP.md](../MVP.md) and [MONOREPO_SCOPE.md](../MONOREPO_SCOPE.md).

On `setup --scope project` (or `--profile dev`):

1. Resolve or create **editing deck** (prompt or `--deck-name dev`).
2. Write `.agent-deck/deck.yaml` with `deck_id` + `name`.
3. Harness **project** block upgraded to:

   > On task start: `bind_workspace` with repo root. For PRD, spec, or “playbook” tasks: `get_bound_deck` then `get_playbook` by trigger — **do not** read `~/.agent-deck/*.db` or vault files directly.

4. Optional: `setup_repo_deck` MCP call from CLI after write (validates round-trip).

### Layer 3 — Content sync (NEW for dev profile)

**Problem:** Playbooks on production `dev` deck ≠ monorepo dev DB.

**Options (pick one for v1):**

| Option | Pros | Cons |
|--------|------|------|
| **A. Seed script** | `npm run seed:dev-deck` imports PB markdown from `docs/examples/playbooks/` + PRD playbooks export | One-time; drift if cards edited in dashboard only |
| **B. Single data dir for dogfood** | `AGENT_DECK_DEV=0` when working on agent_deck repo | Mixes prod data |
| **C. Bundle import in setup** | `setup --profile dev --import-playbooks-from-prod` | Needs [PRD_EXPORT_IMPORT.md](../PRD_EXPORT_IMPORT.md) |
| **D. Git-tracked playbook stubs** | `docs/examples/playbooks/*.md` + seed on `postinstall` | Good for OSS contributors |

**Recommendation:** **D + seed script** for `agent_deck` repo; **C** long-term for Chi-style laptop migration.

### Layer 4 — Verify (NEW)

Extend `agent-deck doctor` (or `doctor --agent-path`):

```
[ ] MCP reachable at configured URL
[ ] bind_workspace(cwd) succeeds
[ ] get_bound_deck playbooks returns ≥1 card when dev deck seeded
[ ] get_playbook(pb_ai_codegen_prd) returns body
[ ] WARN if ~/.agent-deck/dev and ~/.agent-deck both have deck named "dev" with different IDs
```

Fail with actionable fix commands.

---

## Harness changes (Layer 2)

Add to `GLOBAL_BODY` in `packages/cli/src/agent-harness.ts`:

1. **Mandatory bind** — first agent-deck call per session: `bind_workspace` (or `get_session_binding` if already bound).
2. **Playbook gate** — when user mentions PRD, spec, playbook, or task matches triggers: `get_bound_deck` → `get_playbook`; never read SQLite/Keychain.
3. **Failure mode** — if bind fails, call `get_decks` and retry `bind_workspace({ workspaceRoot, deckId })`; do not read `.agent-deck/deck.yaml`.

Keep harness short; link `docs/AGENT_HARNESS.md` for detail.

---

## `agent_deck` repo dogfood checklist

- [ ] Commit `.agent-deck/deck.yaml` → monorepo dev deck UUID
- [ ] Commit `.cursor/mcp.json` (project) → `http://127.0.0.1:3001/mcp`
- [ ] `scripts/seed-dev-deck.ts` — playbooks `pb_ai_codegen_prd`, `pb_product_principle` into `~/.agent-deck/dev/`
- [ ] `npm run dev:all` post-start hook or README step: run seed + doctor
- [x] DEVELOPMENT.md: agents use MCP playbooks, not sqlite3

---

## `dev:all` script enhancement (optional)

After starting services:

```bash
npm run agent-deck:dev -- doctor --agent-path
# or auto-seed if playbooks table empty
```

---

## Out of scope (this ADR)

- [PRD_EXPORT_IMPORT.md](../PRD_EXPORT_IMPORT.md) (helps Layer 3 option C)
- [PRD_DECK_DISPLAY.md](../PRD_DECK_DISPLAY.md) (visibility, not bypass prevention)
- Replacing git-tracked PRDs — playbooks and `docs/*/PRD.md` can coexist; playbook drives **process**, PRD is **artifact**

---

## Decision (proposed)

1. Treat **project setup** as MCP + harness + **deck.yaml** — not MCP alone.
2. Add **`--profile dev`** for monorepo port/data alignment.
3. **Seed dev deck playbooks** in `agent_deck` repo CI/dev workflow.
4. **Harden harness** with explicit anti-bypass language.
5. **Doctor --agent-path** before claiming Agent Deck works in a repo.

---

## Related

- [AGENT_HARNESS.md](../AGENT_HARNESS.md)
- [SETUP.md](../SETUP.md) — dev vs prod data dirs
- [PLAYBOOKS_AND_SKILLS.md](../PLAYBOOKS_AND_SKILLS.md) — discoverability gap
- [PRD_EXPORT_IMPORT.md](../PRD_EXPORT_IMPORT.md) — content portability
