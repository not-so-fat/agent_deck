# Playbook Learning Loop — Proposal Queue Design

**Date:** 2026-07-11 · **Status:** Draft for review · **Scope:** agent_deck core + small agent-dealer change

**Problem:** Corrections given to agents during business tasks are almost never converted into playbook improvements. Evidence: 18 playbooks in the live DB, ~2 ever updated after creation, despite daily corrections. Root causes: (1) the self-improvement rule only covers sessions that already fetched a playbook (genesis gap), (2) the trigger is agent-memory-dependent, (3) the correction signal is never persisted, (4) no versioning/review rail exists to make higher write volume safe.

**Decisions locked upstream** (Obsidian notes 2026-07-11, user-approved):

- Corrections come from both interactive IDE sessions and dealer runs → one queue, in agent_deck (the knowledge layer), many producers.
- **Propose-first:** agent-generated changes land as proposals with diffs; the user accepts/rejects in the dashboard.
- **Item-level deltas, not full-body rewrites** (ACE: context collapse / brevity bias).
- Queue supports **create / update / merge / retire** proposal kinds from day one (SkillOS lifecycle; merge/retire producers come later, schema now).
- **Tiny genesis is valid:** title + trigger + one gotcha is an acceptable new-playbook proposal.
- Lightweight **usage logging** (fetch counts) to measure undertriggering — no A′ architecture dependency; `get_playbook` already transits backend REST.

Related direction: extends DIRECTION.md Phase 1 (D3 learning loop). The per-deck-endpoint architecture (A′) is a separate future spec; nothing here depends on it, and everything here survives it.

---

## 1. Architecture overview

```
IDE session (Cursor / Claude Code)          agent-dealer reflect run
        │  MCP: propose_playbook_patch              │  REST: POST patches
        ▼                                           ▼
             agent_deck backend  ──  playbook_patches (proposed)
                                          │
                              dashboard review queue (diff UI)
                                          │ accept            │ reject(reason)
                                          ▼                   ▼
                        apply ops → playbooks table      status=rejected
                        + playbook_versions row
```

One new module in the backend (`src/playbooks/patches.ts` + routes), one new MCP tool, one dashboard page, one dealer change (reflect posts here instead of keeping a private artifact).

## 2. Data model (SQLite)

### `playbook_patches`

| column | type | notes |
|---|---|---|
| `id` | TEXT PK | `pp_<nanoid>` |
| `kind` | TEXT | `create` \| `update` \| `merge` \| `retire` |
| `playbook_id` | TEXT NULL | target; NULL only for `create` |
| `ops_json` | TEXT | delta operations (below); for `create`: the initial card fields |
| `rationale` | TEXT | why this change helps future runs |
| `source` | TEXT | `ide` \| `dealer` \| `hook` \| `harvester` |
| `source_ref` | TEXT NULL | dealer run id / session hint — provenance |
| `status` | TEXT | `proposed` \| `accepted` \| `rejected` \| `stale` |
| `rejection_reason` | TEXT NULL | rejection reasons are signal; keep them |
| `created_at` / `resolved_at` | TEXT | |

### `playbook_versions`

Append-only snapshot written **on accept** (and on direct `update_playbook`, so manual edits are versioned too): `id`, `playbook_id`, `title`, `body`, `triggers`, `patch_id NULL`, `actor` (`user` \| `agent`), `created_at`. Rollback = re-apply an old version via a new version row (never delete history).

### `playbook_events`

Usage telemetry: `playbook_id`, `event` (`fetched`), `source` (REST caller: MCP session vs dealer), `created_at`. Written by the existing `GET /api/playbooks/:id` handler. Cheap now; feeds curation later.

## 3. Delta operations format

Playbook bodies stay plain markdown. Ops target **list items within sections** (`## Steps`, `## Checklist`, `## Gotchas`, …). Anchoring is by **exact current item text** — no injected IDs; if the anchor no longer matches at accept time, the patch flips to `stale` (staleness detection for free, concurrent proposals can't silently clobber).

```jsonc
// ops_json for kind=update — array of:
{ "op": "add_item",    "section": "Gotchas", "text": "Slack chat.postMessage silently truncates blocks > 50." }
{ "op": "amend_item",  "section": "Steps",   "anchor": "<exact current item text>", "text": "<replacement>" }
{ "op": "remove_item", "section": "Checklist", "anchor": "<exact current item text>" }
{ "op": "set_triggers","triggers": ["check inbox", "review applicants"] }
{ "op": "rewrite_body","text": "<full new body>" }   // escape hatch for restructuring; review UI flags it loudly
```

- `add_item` creates the section (at body end) if missing — works on today's unstructured bodies without migration.
- `rewrite_body` exists because the harness principle "restructure if the structure can't absorb the lesson" is real, but it's the exception: producers are instructed to prefer item ops, and the review UI renders rewrites as full-body diffs with a warning.
- For `kind=create`: `ops_json` holds `{ title, body, triggers, exec?, skill?, deck_id }` — `deck_id` is resolved at propose time (MCP: the session's bound deck; dealer: the run's deck) so accept knows where to link the new card. Minimal body (one gotcha) is explicitly valid.
- `merge` / `retire`: schema + accept semantics defined (merge = ops applied to survivor + retire of the other; retire = unlink from decks, card kept), **no producer in this phase** — dashboard-only creation if wanted, else dormant.

Apply logic lives in one pure function (`applyPatchOps(body, ops) → { body } | { conflict }`) — unit-testable, shared by preview (dashboard diff) and accept.

## 4. API surface

| Route | Purpose |
|---|---|
| `POST /api/playbook-patches` | create proposal (all kinds; dealer + MCP tool both land here) |
| `GET /api/playbook-patches?status=proposed` | queue listing (dashboard) |
| `GET /api/playbook-patches/:id/preview` | current body + ops applied → before/after for diff render |
| `POST /api/playbook-patches/:id/accept` | validate anchors → apply → write version → link new card to deck (create) → status accepted; anchor mismatch → 409 + status stale |
| `POST /api/playbook-patches/:id/reject` | body: `{ reason }` |

### MCP tool: `propose_playbook_patch`

One tool (tool-surface discipline): `{ kind, playbook_id?, ops?, new_playbook?, rationale }`. Registered alongside existing playbook tools; description states it is the **default** way for agents to change playbooks. `update_playbook` remains for explicit user-directed edits ("please fix the playbook to say X" = user already reviewed) — its handler now also writes a `playbook_versions` row.

## 5. Dashboard: review queue

New page (badge count in nav when proposals pending):

- List proposed patches: playbook title (or "NEW: <title>"), kind, source, rationale, age.
- Detail: **item-level diff** (ops rendered as added/removed/changed lines against current body via preview endpoint); `rewrite_body` shown as full diff + warning banner.
- Accept / Reject (reason required — one line). Stale patches shown greyed with re-propose hint.
- Playbook card view gains: version history list (diff any two), fetch-count sparkline from `playbook_events`.

## 6. Harness rewrite (`packages/cli/src/agent-harness.ts` templates)

Behavior 3 (self-improvement) becomes:

1. **Update case** (followed a playbook this session, user corrected the output): fix the output, then `propose_playbook_patch` with item ops — **prefer one `add_item` to Gotchas/Checklist**; `rewrite_body` only when structure can't absorb the lesson.
2. **Genesis case (new):** user corrected you ≥1× on a task **no playbook covered** → before ending, `propose_playbook_patch { kind: "create" }` — *a few lines and a single gotcha is the right size*; do not write a comprehensive procedure.
3. **Update principles (amended per ACE):** generalize *identifiers* (project names, paths, schemas) but **keep concrete failure detail** — an abstract lesson that lost its gotcha is noise. Place: checklist for verification, technique for patterns, anti-pattern/gotcha for mistakes.
4. Tell the user a proposal was filed (one line) — review happens in the dashboard, not in-chat.

CLAUDE.md / .mdc templates and PLAYBOOKS_AND_SKILLS.md / AGENT_HARNESS.md update accordingly (propose-first wording). Users must re-run `agent-deck setup` — CHANGELOG migration note required.

## 7. agent-dealer change (small)

`runReflect` (packages/server/src/runners/reflect.ts):

- Prompt changes: output `{ rationale, ops: [...] }` (item deltas) instead of `{ rationale, proposedBody }`.
- On parse success: `POST /api/playbook-patches` (source `dealer`, `source_ref` = run id) instead of writing a private `playbook_patch` artifact; keep a slim artifact `{ patchId, status: "proposed" }` so the review drawer links to the deck dashboard.
- Dealer's own accept path for patches is removed (single review surface: agent_deck dashboard).

## 8. Error handling

- Anchor mismatch at accept → 409, patch → `stale`; never partial-apply (ops apply is all-or-nothing).
- Proposal referencing a deleted playbook → reject-on-sight with system reason.
- Backend offline when proposing (dealer) → existing `checkAgentDeckHealth` skip path, reflect_status records it.
- MCP propose with malformed ops → tool error with the expected shape (agent can retry).

## 9. Testing

- **Unit:** `applyPatchOps` — every op, section-missing creation, anchor conflict, all-or-nothing on mixed valid/invalid, unicode/whitespace anchor equality.
- **REST:** patch lifecycle (propose → preview → accept/reject/stale), version row on accept and on `update_playbook`, event row on playbook GET.
- **MCP:** `propose_playbook_patch` happy path + malformed ops via existing MCP test harness.
- **Dealer:** reflect prompt→ops parse fixture; POST payload shape (mock backend).
- **Manual (verify skill):** end-to-end — correct an agent in this repo's session → proposal appears in dashboard → accept → next `get_playbook` serves updated body.

## 10. Exit criteria (extends DIRECTION Phase 1)

- A week of normal work produces ≥3 proposals from real corrections (vs ~2 total in the loop's lifetime).
- At least one accepted lesson demonstrably prevents a repeat correction.
- Fetch counts visible per playbook (undertriggering measurable — feeds the A′ decision with data).

## Out of scope (later sub-projects)

- A′ per-deck endpoints, trigger stubs, meta-tool removal (separate ADR/spec).
- Stop-hook capture, transcript harvester, automated curation pass (producers into this same queue).
- D4 memory cards — but `kind` column and create-ops shape deliberately leave room for `kind: memory` proposals.
