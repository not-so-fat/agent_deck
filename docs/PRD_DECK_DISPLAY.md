---
playbooks: pb_ai_codegen_prd, pb_product_principle
---

# Bound deck display — AI Codegen PRD

**One-liner:** Cursor and Claude Code users always see which Agent Deck is bound to the current workspace — in the prompt status line — without opening the dashboard or parsing MCP JSON.

**Status:** Phase 5a shipped · **Codegen load path:** `docs/PRD_DECK_DISPLAY.md` · **Contracts:** `packages/shared/src/schemas/deck-display.ts` (Zod + exported JSON Schema)

---

## 1. Product overview

Agent Deck scopes MCP tools via a **bound deck** (session override, env, or repo `.agent-deck/deck.yaml`). The [agent harness](./AGENT_HARNESS.md) teaches agents to call `bind_workspace` but exposes **no human-visible indicator** of which deck is active. Users report uncertainty after `switch_bound_deck` or when multiple decks share similar MCP sets.

This PRD specifies a **binding sidecar file**, a **`agent-deck statusline` CLI** integrated with Cursor/Claude status lines, a display API, and minimal MCP/harness additions. Session binding remains in-memory (`McpSessionBindingStore`); the sidecar bridges MCP events to host UI.

**Success criteria (time-boxed):**

| # | Criterion | Target window |
|---|-----------|---------------|
| SC-1 | Status line shows correct deck name within one prompt update after `bind_workspace` | Phase 5a |
| SC-2 | `switch_bound_deck` updates status line without editing `deck.yaml` | Phase 5a |
| SC-3 | Repo with only `deck.yaml` shows deck when Agent Deck is running | Phase 5a |
| SC-4 | No secret values in sidecar, status line, or summary resource | Phase 5a |
| SC-5 | `agent-deck setup --statusline` installs config idempotently | Phase 5b — shipped |

---

## 2. Target users & roles

| Persona | Goal | v1 surface |
|---------|------|------------|
| **Cursor / Claude Code user** | Glance at prompt footer for active deck | Status line via `agent-deck statusline` |
| **Solo dev** | Confirm bind worked | Sidecar + status line |
| **Monorepo dev** | Correct deck when cwd is a package subfolder | Workspace walk-up ([MONOREPO_SCOPE.md](./MONOREPO_SCOPE.md)) |
| **Agent (MCP)** | One-line deck summary | `get_session_binding.display_summary` |
| **Power user** | Debug wrong deck | `agent-deck statusline --workspace <path>` |

**Voice:** Cold-reader. Distinguish **editing deck** (dashboard `localStorage`) from **bound/effective deck** (agent scope) — only the latter appears in the status line.

---

## 3. User stories (testable)

### US-1 — See deck after bind

**As a** Cursor user **I want** the status line to show my deck name after `bind_workspace` **so that** I know scoping succeeded.

**Acceptance:**

- [ ] After successful `bind_workspace`, status line within 300 ms (next host refresh) shows `◆ <deckName> · <counts>`
- [ ] Sidecar file updated at `~/.agent-deck/bindings.json` (or dev path)
- [ ] No deck name written to `agent-deck.mdc` / CLAUDE.md

*v1 · Phase 5a*

### US-2 — Session deck override visible

**As a** user who called `switch_bound_deck` **I want** the status line to reflect the override **so that** I know `deck.yaml` was not edited.

**Acceptance:**

- [ ] Status line shows new deck name after `switch_bound_deck`
- [ ] `source: session_override` reflected in API `GET /api/scope/display` (optional suffix in line)

*v1 · Phase 5a*

### US-3 — Manifest-only workspace

**As a** user with `.agent-deck/deck.yaml` but no explicit bind **I want** the status line to resolve the manifest deck **so that** I see scope before the agent calls MCP.

**Acceptance:**

- [ ] `agent-deck statusline` with `cwd` in repo resolves via `POST /api/scope/resolve` when sidecar absent
- [ ] Shows deck name from manifest `deck_id`

*v1 · Phase 5a*

### US-4 — Agent Deck offline

**As a** user when the backend is stopped **I want** a non-breaking status line **so that** my prompt still works.

**Acceptance:**

- [ ] Status line prints `◆ Agent Deck offline` or empty string (configurable); exit 0
- [ ] No hang beyond `timeoutMs` (default 1500 ms)

*v1 · Phase 5a*

### US-5 — One-shot setup

**As a** new user **I want** `agent-deck setup --statusline` **so that** I do not hand-edit `cli-config.json`.

**Acceptance:**

- [ ] Merges `statusLine.command: agent-deck statusline` into `~/.cursor/cli-config.json`
- [ ] Re-run is no-op when already current
- [ ] Documented for Claude Code equivalent

*Deferred · Phase 5b*

### US-6 — Dashboard sessions panel

**As a** debugger **I want** to see all sidecar bindings **so that** I can fix stale workspace keys.

**Acceptance:**

- [ ] `GET /api/scope/bindings` lists workspace → deck rows with `updatedAt`

*Deferred · Phase 5c*

---

## 4. Features & requirements

### Pillar A — Binding sidecar

| Req ID | Requirement | Acceptance |
|--------|-------------|------------|
| F1.1 | On `bind_workspace` / `switch_bound_deck` success, upsert sidecar entry keyed by **MCP session id** | File matches `BindingsFile` schema (§7.1) |
| F1.2 | Sidecar path under `resolveAgentDeckHome()` | `bindings.json` |
| F1.3 | Entry includes `deckId`, `deckName`, `source`, `updatedAt`, `cardCounts` | No secrets |
| F1.4 | **Per-session** bindings; same workspace path may have different decks in different sessions | No “last bind wins per path” for status |

### Pillar B — Display resolution

| Req ID | Requirement | Acceptance |
|--------|-------------|------------|
| F2.1 | Precedence: **session** sidecar → env (`AGENT_DECK_*`) → repo manifest → unbound | Matches Module 1 bind order |
| F2.2 | `GET /api/scope/display?workspaceRoot=&sessionId=` returns `DeckDisplay` (§7.2) | Used by statusline |
| F2.3 | Monorepo walk-up for manifest | Same rules as `loadRepoDeckManifest` |
| F2.4 | Unbound returns `deckName: null`; status line shows `—` or hides | US-4 |

### Pillar C — Status line CLI

| Req ID | Requirement | Acceptance |
|--------|-------------|------------|
| F3.1 | `agent-deck statusline` reads JSON stdin (`StatusLinePayload`) | Uses `session_id` + `cwd` |
| F3.2 | `agent-deck statusline --workspace <path>` for debug | No stdin required |
| F3.3 | Output format: `◆ {name} · {counts} (updated YYYY-MM-DD HH:mm)` when bound | Max 120 chars; truncate name |
| F3.4 | Respects `AGENT_DECK_PORT` / CLI defaults for API URL | Works in dev and prod |
| F3.5 | Exit 0 always unless misconfiguration | Never blocks host |
| F3.6 | **No timer polling** in setup — host refreshes on prompt/conversation update only | Claude: omit `refreshInterval`; Cursor: omit `updateIntervalMs` |

### Pillar D — MCP & harness

| Req ID | Requirement | Acceptance |
|--------|-------------|------------|
| F4.1 | `get_session_binding` adds `display_summary` string | Same format as F3.3 |
| F4.2 | Resource `agent-deck://bound-deck/summary` plain text | mime `text/plain` |
| F4.3 | Harness adds one static line: user may see deck in status line; do not repeat each turn | `packages/cli/src/agent-harness.ts` |
| F4.4 | Do not inject dynamic deck into harness files | Code review gate |

### Pillar E — Setup

| Req ID | Requirement | Acceptance |
|--------|-------------|------------|
| F5.1 | `setup --statusline` merges Cursor cli-config | Idempotent |
| F5.2 | Document Claude Code status line in [SETUP.md](./SETUP.md) | Link to Claude docs |

---

## 5. Pricing model

*Skipped — display feature; no billing.*

---

## 6. Design principles

| Principle | Requirement |
|-----------|-------------|
| Fail soft | F3.5, US-4 |
| No secrets in UI | F1.3, SC-4 |
| Static harness | F4.4 |
| Workspace-native | Host already knows `cwd`; no new host APIs for P0 |

---

## 7. Cross-cutting contracts

JSON Schema Draft 2020-12. Implementation: `packages/shared/src/schemas/deck-display.ts`.

### 7.1 Bindings file (`bindings.json`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://agent-deck.dev/schemas/bindings-file/v1.json",
  "type": "object",
  "additionalProperties": {
    "type": "object",
    "required": ["deckId", "deckName", "source", "updatedAt", "cardCounts"],
    "properties": {
      "deckId": { "type": "string", "format": "uuid" },
      "deckName": { "type": "string" },
      "source": { "enum": ["session_override", "repo_manifest", "env"] },
      "updatedAt": { "type": "string", "format": "date-time" },
      "cardCounts": {
        "type": "object",
        "properties": {
          "mcp": { "type": "integer", "minimum": 0 },
          "credentials": { "type": "integer", "minimum": 0 },
          "playbooks": { "type": "integer", "minimum": 0 }
        }
      },
      "oauthWarningCount": { "type": "integer", "minimum": 0 }
    }
  },
  "description": "Keys are absolute workspace root paths"
}
```

### 7.2 Deck display API (`DeckDisplay`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://agent-deck.dev/schemas/deck-display/v1.json",
  "type": "object",
  "required": ["workspaceRoot", "deckId", "deckName", "source", "cardCounts", "agentDeckOnline"],
  "properties": {
    "workspaceRoot": { "type": "string" },
    "deckId": { "type": ["string", "null"], "format": "uuid" },
    "deckName": { "type": ["string", "null"] },
    "source": {
      "enum": ["session_override", "repo_manifest", "env", "unbound"]
    },
    "cardCounts": {
      "type": "object",
      "properties": {
        "mcp": { "type": "integer" },
        "credentials": { "type": "integer" },
        "playbooks": { "type": "integer" }
      }
    },
    "oauthWarningCount": { "type": "integer" },
    "agentDeckOnline": { "type": "boolean" },
    "displayLine": {
      "type": "string",
      "description": "Pre-rendered status line per F3.3"
    }
  }
}
```

### 7.3 Status line stdin (`StatusLinePayload` subset)

| Field | Type | Required | Use |
|-------|------|----------|-----|
| `session_id` | string | yes (from host) | Lookup session-scoped sidecar + display API |
| `cwd` | string | yes | Resolve workspace for manifest fallback |
| `workspace.current_dir` | string | no | Fallback if `cwd` absent |

Agent Deck ignores model, tokens, and other payload fields.

**Session id contract:** `bindings.json` keys use the MCP session id written on `bind_workspace`. The host must pass the same id as `session_id` in the status line stdin payload so the footer reflects that session’s deck (not another session at the same path).

---

## 8. Technical constraints & preferences

| Constraint | Detail |
|------------|--------|
| **As-built** | `McpSessionBindingStore` in-memory only (`packages/backend/src/mcp-session-binding.ts`) |
| **MCP tools** | `bind_workspace`, `switch_bound_deck`, `get_session_binding` (`packages/backend/src/mcp-server.ts`) |
| **Harness** | Static `agent-deck.mdc` / CLAUDE.md markers ([AGENT_HARNESS.md](./AGENT_HARNESS.md)) |
| **Cursor status line** | `~/.cursor/cli-config.json` `statusLine.type: command` |
| **Codegen entry** | `packages/cli/src/statusline.ts` + backend route `GET /api/scope/display` |

**Example Cursor config:**

```json
{
  "statusLine": {
    "type": "command",
    "command": "agent-deck statusline",
    "padding": 2,
    "timeoutMs": 1500
  }
}
```

---

## 9. Non-functional requirements

| NFR | Target | Measurement |
|-----|--------|-------------|
| NFR-1 Statusline cold latency | p95 < 300 ms | `agent-deck statusline` with running backend; n ≥ 50 |
| NFR-2 Statusline offline latency | p95 < 100 ms | Backend stopped; fail fast |
| NFR-3 Sidecar write | Non-blocking on MCP bind path | p95 < 10 ms added to bind tool |
| NFR-4 Display line length | ≤ 120 characters | Unit test |
| NFR-5 Secret leakage | 0 secret fields in sidecar/display | Static analysis + test |

---

## 10. Out of scope

| Item | Rationale |
|------|-----------|
| Cursor/Claude IDE Agent chat panel | No host API; deferred — terminal statusline only |
| Dynamic harness / per-bind rule rewrites | Breaks `setup` idempotency (F4.4) |
| Global single-deck indicator across all repos | Conflicts with workspace bind model |
| Dashboard live mirror of every Cursor window | US-6 optional P1 only |
| Showing **editing deck** in status line | Different concept from bound deck |
| Claude Desktop status line | Unknown support; document MCP fallback |

---

## 11. Milestones

| Week | Exit criteria |
|------|---------------|
| **5a** | Sidecar F1.*; API F2.*; CLI F3.*; MCP F4.1–F4.2; SC-1–SC-4 |
| **5b** | Setup F5.*; harness F4.3; SC-5 |
| **5c** | Dashboard bindings panel US-6; oauth warning suffix (OD-1) |

---

## 12. Open decisions

| Question | Default if undecided | Owner |
|----------|----------------------|-------|
| OD-1 Show OAuth warning count in status line (`· 1 reconnect`)? | No in 5a; add in 5c if room under 120 chars | Product |
| OD-2 Claude Desktop status line support? | Document `get_session_binding` only | Docs |
| OD-3 Cursor Chat (non-CLI) deck badge? | Defer; out of scope §10 | Product |

---

## 13. How to use this PRD

| Consumer | Directive |
|----------|-----------|
| **Engineer** | Land 5a (sidecar + statusline + API) before setup UX. Wire sidecar write in MCP bind handlers first. |
| **AI codegen** | Implement §7 schemas, then `statusline.ts`, then MCP `display_summary`, then setup flag. |
| **User** | Run `agent-deck setup --client cursor --statusline` after upgrading to build with 5b. |
| **Agent** | Use `display_summary` from `get_session_binding`; do not spam deck name if user sees status line (F4.3). |

---

## Appendix — source notes

| Source | Captured as |
|--------|-------------|
| Agent Deck playbook `pb_ai_codegen_prd` on **dev** deck | Document structure |
| Agent Deck playbook `pb_product_principle` | Voice, editing vs bound deck distinction |
| User request — display deck in Cursor/Claude | §1 problem |
| [MVP.md](./MVP.md) Module 1 bind precedence | F2.1 |
| [AGENT_HARNESS.md](./AGENT_HARNESS.md) | F4.3, §10 harness |
| `packages/backend/src/mcp-session-binding.ts` | §8 in-memory gap |
| Cursor status line skill / Claude statusline docs | §8 config |

---

## Codegen-readiness checklist

- [x] One-sentence value statement at top
- [x] Every user story has verifiable acceptance checkboxes
- [x] Every requirement has stable `Req ID`
- [x] Cross-boundary shapes are JSON Schema (§7)
- [x] NFR table has measurement window + sample size
- [x] Out of scope in exactly one section (§10)
- [x] Open decisions have Default if undecided (§12)
- [x] Codegen load path + contracts directory named (§8)
- [x] Statusline stdin subset committed (§7.3)
- [x] Pricing section skipped (§5)
