---
playbooks: pb_ai_codegen_prd, pb_product_principle
---

# Playbook feedback accumulation & curation — AI Codegen PRD

**One-liner:** Every agent-detected correction is logged permanently via MCP (`propose_playbook_patch` / `signal_only`) into `feedback_signals`; the dashboard exposes the unreviewed backlog for bulk curation (browse, discard, copy prompt for an IDE agent) — agent_deck never calls an LLM and does not add list/discard MCP tools.

**Status:** Draft · **Codegen load path:** `docs/PRD_FEEDBACK_ACCUMULATION.md` · **Contracts:** `packages/shared/src/schemas/feedback-signal.ts`

---

## 1. Product overview

Today (`docs/superpowers/specs/2026-07-11-playbook-learning-loop-design.md`, shipped), every agent-detected correction becomes a standalone `playbook_patches` proposal, reviewed in isolation in the dashboard queue. A single correction is often too weak a signal to generalize from well — it may be noise, an edge case, or need two or three siblings before the right lesson is clear. The July 11 spec already named this gap and deferred it as future work ("capture escalation — Stop hook, transcript harvester, curation pass").

This PRD closes that gap with a durable capture layer (`feedback_signals`) written through the existing MCP propose path, plus a **dashboard bulk-curation surface**: list/count/discard unreviewed signals and copy a prompt for the IDE agent to paste back as consolidated `propose_playbook_patch` calls (with `signal_ids`). Capture = MCP; backlog analysis = dashboard → agent chat. No Anthropic (or other LLM) SDK in the backend; no dedicated list/discard MCP tools.

**Success criteria:**

| # | Criterion | Target |
|---|-----------|--------|
| SC-1 | Every agent-detected correction produces a `feedback_signals` row, whether or not a patch is also drafted immediately | v1 ship |
| SC-2 | From the dashboard, a user can copy ≥2 unreviewed signals into an IDE agent prompt and get ≥1 consolidated proposal that marks those signals `actioned` via `signal_ids` | v1 ship |
| SC-3 | Nav/dashboard shows unreviewed-signal count so backlog is visible before the user starts bulk curation | v1 ship |
| SC-4 | A standalone script can backfill historical signals from a Claude Code transcript directory on a machine with no agent_deck backend running locally | v1 ship |

---

## 2. Target users & roles

| Persona | Goal | v1 surface |
|---------|------|------------|
| **Solo dev running IDE sessions** | Corrections given mid-task aren't lost even when they're too weak to act on alone | Harness auto-logs signal on every correction |
| **Deck owner reviewing playbooks** | Decide when to turn accumulated corrections into playbook changes, on their own schedule | Dashboard backlog (copy for agent / discard) + unreviewed-signal badge |
| **New user migrating history** | Bootstrap playbooks from corrections given before this feature existed | Standalone backfill CLI script |

**Voice:** Objective, cold-reader. Link `docs/superpowers/specs/2026-07-11-playbook-learning-loop-design.md` for prior-art terminology (`playbook_patches`, ops, evidence).

---

## 3. User stories (testable)

### US-1 — Every correction is captured

**As a** solo dev **I want** every correction I give an agent to be logged **so that** a correction that seems minor in isolation isn't lost if it turns out to matter later.

**Acceptance:**

- [ ] `propose_playbook_patch` (any `kind`, including the new `signal_only`) always inserts a `feedback_signals` row before anything else
- [ ] Row is written even when the resulting patch proposal is rejected or goes stale later
- [ ] Row fields (`failure_summary`, `user_feedback_excerpt`, `corrected_output_hint?`) are immutable after insert; only `status` and `linked_patch_id` change
- [ ] Immediate kinds (`update` / `create` / …) insert the signal as `status: "actioned"` with `linked_patch_id` set to the new patch, **unless** the call already carries `signal_ids` (a curation submit) — in that case no new row is created, only the referenced ids transition; `signal_only` inserts as `unreviewed` with `linked_patch_id: null`
- [ ] On patch **accept**, linked signal(s) stay `actioned`; on **reject** or **stale**, linked signal(s) reopen to `unreviewed` with `linked_patch_id` cleared (re-enter backlog) — a stale anchor means the anchor drifted, not that the correction stopped mattering

*v1*

### US-2 — Defer a correction instead of proposing immediately

**As a** solo dev **I want** to let the agent log a correction without drafting a patch when it isn't confident the fix generalizes yet **so that** the review queue isn't cluttered with premature single-correction proposals.

**Acceptance:**

- [ ] `propose_playbook_patch({ kind: "signal_only", evidence })` stores the signal with `status: "unreviewed"` and creates **no** `playbook_patches` row
- [ ] Harness guidance (agent-harness.ts) instructs the agent to use `signal_only` when a correction is plausible but not yet clearly generalizable, keeping the existing `update`/`create` immediate path for confident corrections
- [ ] Explicit user-directed edits ("fix the playbook to say X") remain unaffected — still route to `update_playbook` directly, never through signal capture

*v1*

### US-3 — Bulk curation starts on the dashboard

**As a** deck owner **I want** to browse the unreviewed backlog in the dashboard and hand selected signals to my IDE agent when I choose **so that** capture stays on MCP while bulk analysis stays a human-gated dashboard path (no list/discard MCP tools, no backend LLM).

**Acceptance:**

- [ ] Dashboard Playbook review page lists unreviewed signals with multi-select discard
- [ ] "Copy for agent" copies a curation prompt + signal JSON (ids included) to the clipboard
- [ ] When the user pastes that prompt into an IDE agent, the agent submits via existing `propose_playbook_patch` with `signal_ids` (MCP capture/propose only — no `list_feedback_signals` tool)
- [ ] Dashboard discard marks rows `discarded` without deleting them
- [ ] Resulting proposals appear in the existing review queue — no new accept/reject UI; **no** backend LLM

*v1*

### US-4 — See accumulation status before deciding to curate

**As a** deck owner **I want** to see how many corrections are waiting **so that** I know when there's enough backlog to ask an agent to curate.

**Acceptance:**

- [ ] Nav badge shows count of `feedback_signals WHERE status = 'unreviewed'`, alongside the existing pending-proposal badge
- [ ] Playbook detail view shows a per-playbook unreviewed-signal count next to the existing fetch-count line

*v1*

### US-5 — Backfill historical corrections

**As a** new user **I want** to mine corrections from Claude Code transcripts that predate this feature **so that** old history isn't a dead end just because no playbook existed at the time.

**Acceptance:**

- [ ] `agent-deck import-feedback-signals <transcript-dir>` reads local Claude Code JSONL transcripts, heuristically detects correction turns, and either POSTs directly to a reachable backend or writes a JSON file for later import
- [ ] Script runs standalone on a machine with no agent_deck backend installed (only needs a transcript directory and, optionally, a `--backend-url`)
- [ ] Imported signals are tagged `source: "backfill"` and are otherwise indistinguishable from live-captured signals in the dashboard backlog

*v1*

---

## 4. Features & requirements

### Pillar A — Capture

| Req ID | Requirement | Acceptance |
|--------|-------------|------------|
| F1.1 | `propose_playbook_patch` writes a `feedback_signals` row on every call **except** curation submits that already carry `signal_ids` | US-1 |
| F1.2 | New `kind: "signal_only"` skips ops drafting and `playbook_patches` creation entirely | US-2 |
| F1.3 | `feedback_signals` rows are immutable except `status`/`linked_patch_id` | US-1 |
| F1.4 | Harness (`agent-harness.ts` Behavior 3) documents when to use `signal_only` vs immediate `update`/`create` | US-2 |

### Pillar B — Dashboard bulk curation

| Req ID | Requirement | Acceptance |
|--------|-------------|------------|
| F2.1 | `GET /api/feedback-signals` (dashboard client) lists signals with status/playbook/deck filters | US-3 |
| F2.2 | `propose_playbook_patch` accepts optional `signal_ids` on any patch-creating kind (`create`/`update`/`merge`/`retire`, incl. genesis clustering with no prior `candidatePlaybookId`); on success those rows become `actioned` + linked, and no separate signal row is written for the call itself | US-3 |
| F2.3 | Dashboard discard via `POST /api/feedback-signals/discard` marks rows `discarded`, never deletes | US-3 |
| F2.4 | Dashboard "Copy for agent" + harness documents paste → propose with `signal_ids`; **no** list/discard MCP tools | US-3 |
| F2.5 | Rejecting **or staling** a `playbook_patches` row reopens linked `feedback_signals` (`unreviewed`, clear `linked_patch_id`) | US-1 |

### Pillar C — Visibility

| Req ID | Requirement | Acceptance |
|--------|-------------|------------|
| F3.1 | `GET /api/feedback-signals/count?status=unreviewed` backs a nav badge | US-4 |
| F3.2 | Playbook detail view shows per-playbook unreviewed count | US-4 |

### Pillar D — Backfill

| Req ID | Requirement | Acceptance |
|--------|-------------|------------|
| F4.1 | Standalone CLI parses local Claude Code JSONL transcripts for correction turns | US-5 |
| F4.2 | CLI POSTs to a reachable backend, or writes an importable JSON file otherwise | US-5 |
| F4.3 | `POST /api/feedback-signals/import` accepts a batch of pre-parsed signal records, tagging `source: "backfill"` | US-5 |

---

## 5. Pricing model

*Skipped — agent_deck does not call an LLM for curation; the host agent uses its existing subscription/API. No new billable surface.*

---

## 6. Design principles

| Principle | Load-bearing requirement |
|-----------|--------------------------|
| Nothing is ever lost | Every correction is logged unconditionally, before any judgment about whether it's patch-worthy (F1.1) |
| Append-only history | Signal rows never get edited or deleted, only status-transitioned (F1.3, F2.3) |
| Reuse the existing review surface | Curated proposals are ordinary `playbook_patches` rows — no second review UI (F2.2) |
| No LLM in agent_deck | Curation reasoning stays in the external agent after a dashboard copy; agent_deck stores signals and accepts proposals (F2.1–F2.4) |
| Capture on MCP, bulk on dashboard | Session agents only write signals via propose; backlog browse/discard/copy is dashboard-only |

---

## 7. Cross-cutting contracts

Implementation: Zod in `packages/shared/src/schemas/feedback-signal.ts` (alongside `packages/shared/src/schemas/playbook-patch.ts`).

### 7.1 `feedback_signals` row (`FeedbackSignal`)

```json
{
  "id": "fs_9f3a2c1b",
  "source": "ide",
  "sourceRef": "mcp-session-abc123",
  "failureSummary": "Agent proposed rewrite_body when an add_item would have sufficed",
  "userFeedbackExcerpt": "just add one line to Gotchas, don't rewrite the whole thing",
  "correctedOutputHint": null,
  "candidatePlaybookId": "pb_ai_codegen_prd",
  "candidateDeckId": "6e825b59-13de-4ddd-ab7e-55ab5a1c279a",
  "linkedPatchId": null,
  "status": "unreviewed",
  "createdAt": "2026-07-22T10:00:00.000Z"
}
```

`source`: `ide` \| `dealer` \| `backfill`. `status`: `unreviewed` \| `actioned` \| `discarded`. `candidatePlaybookId` and `candidateDeckId` are both nullable — genesis-style signals (no playbook exists yet) may carry neither.

**Status lifecycle:**

| Event | Resulting `status` / `linkedPatchId` |
|-------|--------------------------------------|
| `propose` with `kind: signal_only` | new row, `unreviewed` / `null` |
| `propose` with immediate kind, no `signal_ids` | new row, `actioned` / new patch id |
| `propose` with `signal_ids` (curation submit, any patch-creating kind) | **no new row**; referenced ids → `actioned` / new patch id |
| Dashboard discard | `discarded` / unchanged (`null`) |
| Linked patch **accepted** | stays `actioned` |
| Linked patch **rejected** or marked **stale** | `unreviewed` / `null` (reopens for curation — a stale anchor doesn't mean the correction stopped mattering) |

### 7.2 `propose_playbook_patch` — `signal_only` + optional `signal_ids`

```jsonc
{
  "kind": "signal_only",
  "evidence": {
    "failure_summary": "…",
    "user_feedback_excerpt": "…",
    "corrected_output_hint": "…"
  },
  "rationale": "…"
}
```

`signal_only` requires `evidence`; never touches `ops`, `new_playbook`, or `playbook_patches`.

For curation submit (immediate kinds):

```jsonc
{
  "kind": "update",
  "playbook_id": "pb_…",
  "ops": [{ "op": "add_item", "section": "Gotchas", "text": "…" }],
  "rationale": "…",
  "evidence": { "failure_summary": "…", "user_feedback_excerpt": "…" },
  "signal_ids": ["fs_a", "fs_b"]
}
```

`signal_ids` is optional; applies to any patch-creating `kind` (`create`/`update`/`merge`/`retire`), not only `update` — genesis clustering (`kind: "create"` from signals with no `candidatePlaybookId`) is the primary motivating case. When present, only `unreviewed` rows are transitioned and the call itself writes no new signal row (see §7.1 status lifecycle); unknown / already-actioned ids are ignored or reported — do not fail the propose.

### 7.3 `GET /api/feedback-signals` (dashboard only)

```json
// query
{ "status": "unreviewed", "playbookId": "pb_…", "deckId": "…" }  // all optional

// response
{ "signals": [ /* FeedbackSignal[] */ ] }
```

No MCP list tool — agents receive signal JSON via dashboard "Copy for agent".

### 7.4 `GET /api/feedback-signals/count`

```json
{ "unreviewed": 7 }
```

Optional `playbookId` query param scopes the count (F3.2).

### 7.5 Discard (dashboard only)

```json
// POST /api/feedback-signals/discard
{ "signalIds": ["fs_a", "fs_b"] }

// response
{ "discarded": 2, "ids": ["fs_a", "fs_b"] }
```

### 7.6 `POST /api/feedback-signals/import` (backfill batch)

```json
{
  "signals": [
    {
      "source": "backfill",
      "sourceRef": "transcript:2026-06-01-session.jsonl#L142",
      "failureSummary": "…",
      "userFeedbackExcerpt": "…",
      "candidatePlaybookId": null,
      "candidateDeckId": null
    }
  ]
}
```

Partial success per-index (historical bulk import).

---

## 8. Technical constraints & preferences

| Constraint | Detail |
|------------|--------|
| **Stack** | TypeScript monorepo; Fastify backend (`packages/backend/src/routes/`); Zod for all schemas |
| **No LLM in backend** | Do **not** add `@anthropic-ai/sdk` or any model client for this feature |
| **SQLite** | Table `feedback_signals` in `packages/backend/src/models/database.ts` |
| **Codegen entry** | `feedback-signal.ts`, `feedback-signals.ts` routes, extend `register.ts` + `propose_playbook_patch` (`signal_ids`), `agent-harness.ts` |
| **Dashboard** | Unreviewed badge + backlog panel (list, discard, Copy for agent) on playbook review page — no backend Analyze button |
| **MCP surface** | Capture/propose only (`propose_playbook_patch` incl. `signal_only` + `signal_ids`); **no** list/discard feedback MCP tools |
| **Backfill CLI** | `agent-deck import-feedback-signals` — parse JSONL locally; POST optional |
| **Explicitly not used** | Backend Anthropic/OpenAI calls; list/discard MCP tools; agent-dealer `runReflect` |

---

## 9. Non-functional requirements

| NFR | Target | Measurement |
|-----|--------|-------------|
| NFR-1 List latency (≤100 unreviewed signals) | p95 < 100 ms | Local, n ≥ 20 |
| NFR-2 Signal write latency (`propose_playbook_patch`, any kind) | p95 < 200 ms added over today's call | Local, n ≥ 20 |
| NFR-3 Backfill throughput | ≥ 500 transcript turns/min parsed | Local, n ≥ 3 transcript dirs |
| NFR-4 Data durability | 0 signal rows lost or mutated outside `status`/`linked_patch_id` | Unit test on repository layer |

---

## 10. Out of scope

| Item | Rationale |
|------|-----------|
| Backend LLM / Anthropic curation pass | Product cut — host agent curates after dashboard copy |
| List/discard MCP tools for feedback | Overkill; backlog is dashboard-gated; MCP stays write/propose |
| Scheduled/automatic analysis (cron, threshold-triggered) | User/agent initiated only |
| Live in-session "propose now or defer?" prompt per correction | Agent judges via `signal_only` vs immediate kinds (US-2) |
| New review UI for raw signals | Curated output reuses `playbook_patches` queue |
| agent-dealer integration | Explicit product cut |
| Backfill from agent-dealer run artifacts | Deferred; v1 = Claude Code transcripts only |

---

## 11. Milestones

| Phase | Exit criteria |
|-------|----------------|
| **v1a — Capture** | `feedback_signals` table; propose writes signal (except curation `signal_ids` submits); `signal_only`; harness; unit tests |
| **v1b — Dashboard bulk curation** | List/discard APIs (dashboard); Copy for agent; `signal_ids` on propose; harness paste recipe; tests |
| **v1c — Visibility + backfill** | Nav badge + per-playbook count; backfill CLI + `/import`; SC-1–SC-4 |

---

## 12. Open decisions

| Question | Default if undecided | Owner |
|----------|----------------------|-------|
| OD-1 Re-open discarded signals? | Stay `discarded`; manual reopen later if needed | Eng |
| OD-2 How should agents group genesis signals (no playbook)? | By `candidateDeckId`, else one unscoped bucket | Eng |
| OD-3 Unknown `signal_ids` on propose? | Ignore unknown / non-unreviewed ids; still create the patch | Eng |

---

## 13. How to use this PRD

| Consumer | Directive |
|----------|-----------|
| **Engineer** | Land Pillar A first, then B (list/discard/`signal_ids`), then C/D. Never add a backend model client for curation. |
| **AI codegen** | Read §7; extend MCP + routes; do not introduce Anthropic/OpenAI dependencies. |
| **Reviewer** | Trace US-1..US-5 to Req IDs; verify §10 (no backend LLM, no second review UI) wasn't re-introduced. |
| **User** | Corrections work as before; say "just note this for later" for `signal_only`; when the badge grows, open Playbook review → Copy for agent (or discard noise). |

---

## Appendix — source notes

| Source | Captured as |
|--------|-------------|
| Agent Deck playbook `pb_ai_codegen_prd` on **dev** deck | Document structure |
| Agent Deck playbook `pb_product_principle` | Voice, scope discipline |
| `docs/superpowers/specs/2026-07-11-playbook-learning-loop-design.md` | Prior-art terminology, deferred curation |
| Brainstorming session, 2026-07-22 | `signal_only`; badge; backfill portability |
| [decisions/no-backend-llm-boundary.md](./decisions/no-backend-llm-boundary.md) | Drop backend Anthropic; MCP = capture/propose only; dashboard = bulk curation (copy for agent / discard) |

---

## Codegen-readiness checklist

- [x] One-sentence value statement at top
- [x] Every user story has verifiable acceptance checkboxes
- [x] Every requirement has stable `Req ID`
- [x] Cross-boundary shapes committed (§7)
- [x] NFR table has measurement window + sample size
- [x] Out of scope in exactly one section (§10)
- [x] Open decisions have Default if undecided (§12)
- [x] Codegen load path + contracts directory named (§8)
- [x] Pricing section addressed with justification (§5)
- [x] No backend LLM dependency for curation
