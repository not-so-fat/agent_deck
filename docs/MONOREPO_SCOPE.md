# Monorepo scope convention

Agent Deck binds **one workspace root** per MCP session. In a monorepo, choose a single convention and stick to it.

## Recommended: one manifest at repo root

Put `.agent-deck/deck.yaml` at the **git root** (the folder you open in Cursor):

```
my-monorepo/
  .agent-deck/
    deck.yaml          # deck_id for the whole monorepo
  apps/web/
  packages/api/
```

**When to use:** Most teams — one deck per product, shared MCPs, API keys, and playbooks across packages.

1. Open the monorepo root in Cursor.
2. Call MCP `bind_workspace({ workspaceRoot: "/path/to/my-monorepo" })`.
3. All packages inherit the same bound deck.

## Alternative: per-package manifests

Each package can have its own `.agent-deck/deck.yaml` pointing at **different** `deck_id` values:

```
my-monorepo/
  apps/web/.agent-deck/deck.yaml      → deck_id: web-stack
  packages/api/.agent-deck/deck.yaml  → deck_id: api-stack
```

**When to use:** Packages with genuinely different tool sets (e.g. frontend deck vs backend deck).

1. Open the **package folder** as the workspace root, or
2. Call `bind_workspace` with that package path explicitly.

There is no automatic “walk up to find deck.yaml” — the bound path must contain the manifest.

## Playbooks in monorepos

Playbooks are **cards** in Agent Deck (My Collection), not markdown files in the repo.

- Register via dashboard or MCP `register_playbook` / `update_playbook`
- Drag playbook cards onto a deck in the dashboard
- Agents on the bound deck read them via `list_playbooks` / `get_playbook`

Repo-local markdown under `docs/examples/playbooks/` is **template content only** — copy into registration when seeding cards. There is no filesystem discovery from `.agent-deck/playbooks/`.

For when to use playbook cards vs Cursor skills, see [PLAYBOOKS_AND_SKILLS.md](./PLAYBOOKS_AND_SKILLS.md).

Example manifest (playbooks are scoped in the dashboard, not listed in yaml):

```yaml
deck_id: 550e8400-e29b-41d4-a716-446655440000
name: Hiring stack
```

## Dashboard vs agent

| Client | Deck selection | Playbooks |
|--------|----------------|-----------|
| **Dashboard** | Pick a deck to edit (`localStorage`) | All cards in My Collection; drag onto editing deck |
| **Agent (MCP)** | `bind_workspace` → `deck.yaml` | Playbook cards linked to the bound deck |

Copy the manifest snippet from the deck sidebar (copy icon) into each repo or package that should use that deck.

## Related

- [MVP.md](./MVP.md) — Module 1 scope spec
- [PLAYBOOKS_AND_SKILLS.md](./PLAYBOOKS_AND_SKILLS.md) — playbooks vs Cursor skills
- [docs/examples/playbooks/](./examples/playbooks/) — sample playbook content for registration
