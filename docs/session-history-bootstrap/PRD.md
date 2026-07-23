---
title: Session-History Playbook Bootstrap — PRD
status: draft
supersedes: null
sources:
  - brainstorm: 2026-07-22 session (this conversation)
  - memory: playbook-learning-loop-direction (phase 3 "capture escalation")
  - playbooks: pb_ai_codegen_prd, pb_product_principle
---

# Session-History Playbook Bootstrap

**Value statement:** A first-time Agent Deck user gets a starter set of playbook *proposals* — mined from their own past Claude Code sessions, including the real corrections they gave — without the backend ever calling an LLM.

## 1. Product overview

Agent Deck's value compounds once a user has playbooks: the learning loop refines them, triggers surface them, and the agent stops re-deriving how the user works. But a **new user starts empty**, and an empty deck can't demonstrate any of that. This is the cold-start problem.

Every Claude Code user already carries a dense record of how they work: `~/.claude/projects/<encoded-workspace>/<sessionId>.jsonl` transcripts holding every request, tool call, and — critically — every time they corrected the agent. This feature turns that history into playbook proposals.

The split is load-bearing and matches Agent Deck's architecture: the **backend parses and reduces with zero LLM**; the **user's own agent authors** the playbooks from the reduced digests, landing them in the existing propose-first review queue.

**One-liner:** Parse local session history into compact digests (deterministically), then let the user's agent draft playbook proposals from them.

**Success criteria (time-boxed):** split by what verifies each — deterministic parts by **CI**, the agent loop by **smoke** (§11 M3).
- **Deterministic exit (CI):** On ≥10 real sessions in ≥1 workspace, `agent-deck bootstrap` exits 0, writes a valid manifest + digests, makes zero network/LLM calls, and prints a committed handoff block (F3.5). Covered by F1–F3 + NFR checks.
- **Agent exit (smoke, human-run):** Following the printed handoff, a bound agent files ≥3 playbook `create` proposals, each carrying ≥1 Gotcha/Technique traceable to a specific `feedbackMoment` — under 5 minutes wall time.

## 2. Target users & roles

**Persona — "Dana, the first-run user":** has used Claude Code for weeks across a few repos, just installed Agent Deck, has an empty deck, and doesn't yet see why playbooks matter. Dana will not hand-write playbooks cold.

| Role | Goal | v1 surface |
|---|---|---|
| First-run user | Get useful playbooks without authoring from scratch | `agent-deck bootstrap` CLI + dashboard review queue |
| Returning user | Backfill playbooks from history accumulated before install | Same CLI, re-runnable |
| Reviewer (same human) | Accept/edit/reject proposals | Existing propose-first dashboard queue |

**PM opener:** the job is *cold-start*, not *ongoing capture*. Success is "the empty state is no longer empty and the proposals are worth keeping," not "we captured everything."

**Voice rules:** CLI output is a cold-reader contract (stdout parsed by the agent and read by a human); no memo-to-reviewer tone.

## 3. User stories (testable)

**US-1 — Bootstrap from history.**
As a first-run user, I want to run one command that scans my past sessions, so that I get candidate playbooks without writing any.
- [ ] `agent-deck bootstrap` exits 0 and writes a manifest + per-session digests to a known path.
- [ ] The command makes **zero** network/LLM calls (verifiable: runs offline).
- [ ] Output names how many sessions/workspaces were processed and where digests landed.

**US-2 — Feedback becomes lessons.**
As a user, I want the corrections I gave in past sessions to seed playbook Gotchas/Techniques, so that proposals reflect what actually went wrong/right for me.
- [ ] Each digest's `feedbackMoments[]` captures ≥ the user reaction, the preceding agent action, and a polarity *hint*.
- [ ] The agent's authoring guide instructs seeding Gotchas from negative moments and Techniques from positive ones.
- [ ] At least one filed proposal contains a Gotcha/Technique traceable to a specific feedback moment.

**US-3 — Proposals, never auto-writes.**
As a reviewer, I want everything to arrive as reviewable proposals, so that nothing is registered without my approval.
- [ ] Bootstrap output reaches the deck **only** via `propose_playbook_patch { kind: "create" }`.
- [ ] No code path in this feature calls `register_playbook` / `create` playbook directly.

**US-4 — Workspaces map to deck clusters.**
As a user with multiple repos, I want proposals grouped by the workspace they came from, so that deck-level organization falls out naturally.
- [ ] Each digest carries `workspaceRoot`; the guide clusters by workspace and proposes into the **bound deck** for the matching workspace only (F4.3) — never into an unbound/mismatched deck.

**Deferred (see §10):** ongoing per-session capture (Stop hook); deck service/key inference; embeddings-based clustering.

## 4. Features & requirements

### F1 — Deterministic parser (`transcript → digest`), no LLM

| Req ID | Requirement | Acceptance |
|---|---|---|
| F1.1 | Read a session `.jsonl` line-by-line; tolerate unknown `type` values and malformed lines. | Malformed line increments a skip counter; parse continues; never throws to caller. |
| F1.2 | Identify **real user turns** vs tool echoes. A real intent = `type:"user"` with string (or text-block) `message.content`, no `toolUseResult` key, `isSidechain` falsey. | Given a session, `intents[]` excludes every `tool_result`-carrying user line and every sidechain turn. |
| F1.3 | Emit a `SessionDigest` (§7.1) per session. Extraction rules are fixed, not inferred: **commands** ← `Bash` tool_use `input.command`, normalized to the first significant token(s), deduped with counts; **tools** ← every assistant `tool_use.name` with counts; **skills** ← `Skill` tool_use `input.skill` **and** user-content slash invocations (`<command-name>` blocks / leading `/name`), deduped; **topFiles** ← `Edit`/`Write`/`Read` tool_use `input.file_path`, counted (edits = Edit+Write). | For a fixture session, each list matches the enumerated source fields exactly; nothing is invented from prose. |
| F1.4 | Digest is size-bounded (§9 NFR-2): cap list lengths (schema `maxItems`) and truncate long strings (`maxLength`). | A pathological 700 KB transcript yields a serialized digest within the NFR-2 byte budget. |
| F1.5 | `workspaceRoot` = `cwd` from the **first line** carrying one; `workspaceLabel` = `basename(workspaceRoot)`. **Do not decode the projects dir name** (Claude's encoding is unspecified). Carry `gitBranch` when present. | Digest `workspaceRoot` byte-equals the session's first-seen `cwd`; label is its basename. |
| F1.6 | Deterministic `outcome.signal`: `pr_opened` ← a `gh pr create` command appears; `committed` ← a `git commit` command appears; else `unknown`. No sentiment/abandonment inference. | Fixtures with/without those commands map to the correct signal; ambiguous → `unknown`. |

### F2 — Feedback-moment extraction

| Req ID | Requirement | Acceptance |
|---|---|---|
| F2.1 | Detect candidate feedback: a real user turn following an assistant `tool_use`/edit action **that also carries a qualifying signal** — ≥1 lexicon marker (F2.2) **or** a structural correction (the next assistant action re-edits a file touched just before, i.e. `followupChange` on the same `file_path`). A bare "user turn after assistant action" does **not** qualify. | Turns with no marker and no re-edit are excluded; a session of pure Q&A yields zero moments. |
| F2.2 | Classify a **polarity hint** via marker lexicon only (negative: "no/don't/actually/instead/wrong/revert/undo…"; positive: "perfect/works/great/ship it/lgtm…"); default `unknown`. | `markers[]` lists which words fired; hint never asserted beyond markers. |
| F2.3 | Attach `followupChange` = the next assistant action after the reaction, when present. | Moment with a subsequent correction carries a non-null `followupChange`. |
| F2.4 | Polarity is a **hint the agent overrides** — the parser never labels worked/didn't-work as fact. | Schema field named `polarityHint`, documented as advisory. |

### F3 — Bootstrap CLI (`agent-deck bootstrap`)

| Req ID | Requirement | Acceptance |
|---|---|---|
| F3.1 | Enumerate local session files under the Claude projects dir; default scope = **all workspaces**, `--workspace <path>` narrows. | Default run lists every workspace with ≥1 session. |
| F3.2 | Each run writes to a **fresh timestamped dir** `~/.claude/agent-deck/bootstrap/<ISO-timestamp>/` (never overwrites prior runs) and updates a stable `~/.claude/agent-deck/bootstrap/latest` pointer to it. `--out <dir>` overrides. | Two runs produce two dirs; `latest` resolves to the newest; `--out` is honored. |
| F3.3 | `--since <date>` / `--limit <n>` / `--workspace <path>` bound the run. | Flags reduce the processed set accordingly. |
| F3.4 | Zero LLM/network calls. | Runs to completion with networking disabled. |
| F3.5 | **Committed handoff:** stdout ends with a fixed, copy-paste-ready block naming (a) the guide to load (`guideRef`), (b) the absolute manifest path, and (c) the instruction "load the guide, read the manifest, propose playbooks for the bound deck." This is the sole, committed handoff — not an open question. | Running the printed block verbatim in a bound agent session drives it to file proposals (smoke, M3). |

### F4 — Authoring guide (single source of truth)

The guide is half the product; it ships as **one artifact** with a committed input shape (opinionated over inference), referenced by the manifest's `guideRef`.

| Req ID | Requirement | Acceptance |
|---|---|---|
| F4.1 | Ship the guide as **one** artifact at a fixed id/path (`guideRef`, e.g. a packaged skill `bootstrap-authoring` / `pb_session_bootstrap_authoring`). Not mirrored into `.cursor/skills/`. | `guideRef` in the manifest resolves to exactly one loadable artifact. |
| F4.2 | The guide commits an **input shape**, not topics: *"1. Read the manifest at the path in the handoff. 2. For the **bound deck's** workspace, load its digests. 3. Cluster digests by task shape (not wording). 4. Per cluster, draft a playbook: triggers ← recurring `intents`; Gotchas ← `negative` feedbackMoments; Techniques ← `positive`; generalize project-specific names/paths. 5. File via `propose_playbook_patch`."* | The guide contains a numbered load→cluster→draft→propose sequence citing digest field names. |
| F4.3 | **Multi-workspace rule (decks are bind-scoped):** the guide directs the agent to propose into the **currently bound deck**, authoring from the digests whose `workspaceRoot` matches the bound workspace; digests from other workspaces are held, not proposed into the wrong deck. Re-run after switching binds for other workspaces. | Guide states one-deck-per-bound-workspace; no proposal targets an unbound deck. |
| F4.4 | The guide directs all output through `propose_playbook_patch { kind:"create" }` — no `register_playbook`. | Following the guide files proposals, not registrations. |

## 5. Pricing model

**Not applicable.** This feature hosts, proxies, and bills nothing. The no-LLM-backend principle means **zero model spend** on Agent Deck's side; the only model cost is the user's own agent authoring proposals, billed to them as any Claude Code turn is. Recorded here explicitly so the omission reads as a decision, not an oversight.

## 6. Design principles

- **Reduce before you reason.** The digest is the whole trick: a pure `transcript → digest` function collapses multi-hundred-KB transcripts to ~500 tokens so a full workspace fits one agent pass. (→ F1, NFR-2.)
- **Semantics belong to the LLM; the backend stays dumb.** Clustering "same kind of task" and judging worked-vs-didn't are LLM jobs. The backend detects, extracts, and hints — never decides. (→ F2.4.)
- **Propose-first, always.** Consistent with the locked learning-loop decision: the human reviews every agent-authored playbook. (→ US-3.)

## 7. Cross-cutting contracts

JSON Schema (Draft 2020-12). These are the boundaries codegen must honor.

### 7.0 Session transcript line (input — consumed, not owned)

Agent Deck does not own this shape (Claude Code writes it); the parser reads a subset and must tolerate the rest. Fields consumed:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://agent-deck/bootstrap/transcript-line.consumed.json",
  "title": "ConsumedTranscriptLineFields",
  "type": "object",
  "properties": {
    "type": { "type": "string", "description": "user | assistant | system | last-prompt | attachment | … (unknown values ignored)" },
    "message": {
      "type": "object",
      "properties": {
        "role": { "type": "string", "enum": ["user", "assistant"] },
        "content": {
          "description": "string = typed user text; array = content blocks (text | tool_use | tool_result)",
          "oneOf": [{ "type": "string" }, { "type": "array" }]
        }
      }
    },
    "toolUseResult": { "description": "PRESENCE marks a tool-echo user line (not a real intent)" },
    "isSidechain": { "type": "boolean", "description": "true = subagent turn; excluded from intents/feedback" },
    "userType": { "type": "string" },
    "cwd": { "type": "string" },
    "gitBranch": { "type": "string" },
    "timestamp": { "type": "string", "format": "date-time" },
    "uuid": { "type": "string" },
    "parentUuid": { "type": ["string", "null"] }
  },
  "required": ["type"],
  "additionalProperties": true
}
```

**Real-intent predicate (F1.2):** `type == "user"` ∧ `content` is `string` (or all-text blocks) ∧ no `toolUseResult` key ∧ `isSidechain !== true`.

### 7.1 SessionDigest (output)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://agent-deck/bootstrap/session-digest.json",
  "title": "SessionDigest",
  "type": "object",
  "required": ["schemaVersion", "sessionId", "workspaceRoot", "startedAt", "turnCount", "intents", "feedbackMoments", "outcome"],
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "const": 1 },
    "sessionId": { "type": "string" },
    "workspaceRoot": { "type": "string" },
    "workspaceLabel": { "type": "string" },
    "gitBranch": { "type": ["string", "null"] },
    "startedAt": { "type": "string", "format": "date-time" },
    "endedAt": { "type": "string", "format": "date-time" },
    "durationMinutes": { "type": "number", "minimum": 0 },
    "turnCount": { "type": "integer", "minimum": 0 },
    "skippedLineCount": { "type": "integer", "minimum": 0 },
    "intents":  { "type": "array", "maxItems": 40, "items": { "type": "object", "required": ["text"], "properties": { "text": { "type": "string", "maxLength": 280 }, "at": { "type": "string", "format": "date-time" } } } },
    "commands": { "type": "array", "maxItems": 40, "items": { "type": "object", "required": ["command", "count"], "properties": { "command": { "type": "string", "maxLength": 160 }, "count": { "type": "integer", "minimum": 1 } } } },
    "tools":    { "type": "array", "maxItems": 40, "items": { "type": "object", "required": ["name", "count"], "properties": { "name": { "type": "string" }, "count": { "type": "integer", "minimum": 1 } } } },
    "skills":   { "type": "array", "maxItems": 40, "items": { "type": "object", "required": ["name", "count"], "properties": { "name": { "type": "string" }, "count": { "type": "integer", "minimum": 1 } } }, "description": "slash-command + Skill invocations — clean recurring-task signal" },
    "topFiles": { "type": "array", "maxItems": 20, "items": { "type": "object", "required": ["path", "edits"], "properties": { "path": { "type": "string" }, "edits": { "type": "integer", "minimum": 1 } } } },
    "feedbackMoments": { "type": "array", "maxItems": 30, "items": { "$ref": "https://agent-deck/bootstrap/feedback-moment.json" } },
    "outcome": {
      "type": "object",
      "required": ["signal"],
      "properties": {
        "signal": { "type": "string", "enum": ["pr_opened", "committed", "unknown"], "description": "F1.6 deterministic rules only; no sentiment/abandonment inference" },
        "evidence": { "type": "string", "description": "the matched command, e.g. 'gh pr create'" }
      }
    }
  }
}
```

### 7.2 FeedbackMoment

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://agent-deck/bootstrap/feedback-moment.json",
  "title": "FeedbackMoment",
  "type": "object",
  "required": ["agentAction", "userReaction", "polarityHint", "markers"],
  "additionalProperties": false,
  "properties": {
    "agentAction":    { "type": "string", "maxLength": 400, "description": "deterministic summary of the preceding assistant action (last tool_use/edit/text)" },
    "userReaction":   { "type": "string", "maxLength": 600, "description": "the user's reply turn, trimmed" },
    "polarityHint":   { "type": "string", "enum": ["negative", "positive", "mixed", "unknown"], "description": "ADVISORY — the agent overrides; parser never asserts worked/didn't-work" },
    "markers":        { "type": "array", "items": { "type": "string" }, "description": "which lexicon words fired" },
    "followupChange": { "type": ["string", "null"], "maxLength": 400, "description": "next assistant action after the reaction, if any" },
    "at":             { "type": "string", "format": "date-time" }
  }
}
```

### 7.3 BootstrapManifest (CLI output → agent handoff)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://agent-deck/bootstrap/manifest.json",
  "title": "BootstrapManifest",
  "type": "object",
  "required": ["schemaVersion", "generatedAt", "digestDir", "guideRef", "totalSessions", "workspaces"],
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "const": 1 },
    "generatedAt": { "type": "string", "format": "date-time" },
    "digestDir": { "type": "string" },
    "guideRef": { "type": "string", "description": "id/path of the authoring guide the agent must load" },
    "totalSessions": { "type": "integer", "minimum": 0 },
    "workspaces": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["workspaceRoot", "label", "sessionCount", "digestPaths"],
        "properties": {
          "workspaceRoot": { "type": "string" },
          "label": { "type": "string" },
          "sessionCount": { "type": "integer", "minimum": 0 },
          "digestPaths": { "type": "array", "items": { "type": "string" } }
        }
      }
    }
  }
}
```

### 7.4 Agent → queue (reused, not redefined)

Proposals use the **existing** `propose_playbook_patch` contract with `kind: "create"` and `new_playbook: { title, triggers, body }`. This feature adds **no** new write path. See `packages/backend/src/playbooks/patch-manager.ts`. (US-3, F4.2.)

## 8. Technical constraints & preferences

- **Stack:** TypeScript, existing monorepo. Parser lives in `packages/backend/src/bootstrap/` as a pure module (`digestSession(lines) → SessionDigest`); CLI subcommand in `packages/cli`. No new runtime deps beyond what's present; **no** LLM/HTTP client added.
- **Input path:** Claude projects dir (`~/.claude/projects/`), overridable via env for tests. `workspaceRoot` = `cwd` from the first line carrying one; `workspaceLabel` = `basename(workspaceRoot)` (F1.5). **Do not decode** projects dir names — Claude's encoding is unspecified.
- **Contracts directory:** JSON Schemas from §7 land in `packages/backend/src/bootstrap/contracts/` (or `packages/shared`) and are imported by parser + tests — schemas are the source of truth, not prose.
- **Codegen load path:** implementation agent loads this PRD + the §7 schemas; repo-specific UI rules (none expected here) stay in project `.cursor/rules/`, never in playbooks.
- **No-LLM invariant:** CI/test asserts the bootstrap module imports no model/HTTP client (US-1, F3.4). This is a hard architectural boundary for all of Agent Deck's backend, not just this feature.
- **Privacy / data flow:** parsing is fully local, but digests carry **verbatim `userReaction` excerpts** and enter the user's agent context — so they leave the machine when the (cloud) agent authors proposals. The digest dir is the user's own (`~/.claude/agent-deck/bootstrap/`); no digest is transmitted by Agent Deck itself. State this in the CLI's first-run output.

## 9. Non-functional requirements

| NFR | Target | Measurement (window + sample) |
|---|---|---|
| NFR-1 Throughput | Parse ≥ 20 sessions/sec on a typical laptop | Median over a run of ≥ 50 real sessions |
| NFR-2 Digest budget | Serialized digest ≤ **4 KB** (chars/bytes, UTF-8) regardless of transcript size (~600 tokens, informational) | Assert `Buffer.byteLength(JSON.stringify(digest))` ≤ 4096 over ≥ 50 digests incl. one ≥ 500 KB transcript |
| NFR-3 Robustness | 0 uncaught throws across a full local history sweep | One sweep of the entire `~/.claude/projects` tree; malformed lines counted, not fatal |
| NFR-4 Determinism | Same input → byte-identical digest | Parse same session twice; diff empty |
| NFR-5 No-LLM | 0 model/network calls during bootstrap | Run with networking disabled over ≥ 10 sessions |

## 10. Out of scope

- **Ongoing per-session capture** (Stop hook / continuous harvester) — separate follow-on spec; this PRD is one-time backfill only.
- **Backend LLM anything** — clustering, summarization, polarity judgment all stay agent-side.
- **Deck service/key inference** — pre-Agent-Deck history contains no registered MCP services or keys; not mineable.
- **Embeddings / semantic clustering in the backend** — the marker lexicon + agent judgment is the v1 mechanism.
- **Cross-machine / cloud history** — local `~/.claude/projects` only.

## 11. Milestones

- **M1 — Parser core.** `digestSession` pure module + §7.1/7.2 schemas + unit tests over fixture transcripts (real-intent predicate, feedback detection, size bounds). Exit: NFR-2/3/4 pass on fixtures.
- **M2 — CLI + manifest + handoff (CI).** `agent-deck bootstrap` enumerates history, writes timestamped digests + manifest + `latest`, prints the committed handoff block (F3.5). Exit: US-1, F3.*, NFR-5 offline run — all CI-verifiable, no agent needed.
- **M3 — Authoring guide + queue path (smoke).** Ship the `guideRef` guide (F4 contract). Following the printed handoff, a bound agent produces ≥3 `create` proposals with feedback-traceable lessons. Exit: US-2/3/4 + the **agent smoke** success criterion (§1). This gate is human-run E2E, not CI — checklist: [SMOKE.md](./SMOKE.md).

## 12. Open decisions

Committed (no longer open): digest location = `~/.claude/agent-deck/bootstrap/<timestamp>/` + `latest` (F3.2); agent handoff = printed block + `guideRef` skill (F3.5, F4); history scope default = all workspaces, `--workspace` narrows (F3.3); one bound deck per run (F4.3).

| Question | Default if undecided | Owner |
|---|---|---|
| Feedback marker lexicon contents | Ship a small English starter list; extend from observed misses | eng |
| Min sessions before bootstrap is worthwhile | Advisory warning under 5 sessions; still runs | eng |
| `latest` pointer form (symlink vs pointer file) | Pointer file (cross-platform; Windows symlink perms) | eng |

## 13. How to use this PRD

- **Engineers:** build F1→F4 in milestone order. Treat §7 schemas as the contract; write them as files first, import into parser and tests. Enforce the no-LLM invariant in CI (§8). Implementation plan: [2026-07-22-session-history-bootstrap.md](../superpowers/plans/2026-07-22-session-history-bootstrap.md).
- **AI codegen agent:** load this PRD + §7 schemas. Parser is a pure function — TDD it against fixture transcripts before wiring the CLI. Do **not** add any model/HTTP dependency to the backend. Route all deck writes through the existing `propose_playbook_patch`.
- **Reviewer:** proposals arrive in the existing dashboard queue; nothing auto-registers.

## Appendix — source notes

| Source | Captured as |
|---|---|
| Brainstorm 2026-07-22 (this session): forks A→A→A→C→A + feedback-moment insight | §1–§4, §6 |
| Memory `playbook-learning-loop-direction` (phase 3 "capture escalation") | §1, §10 |
| Real session `.jsonl` inspection (`~/.claude/projects/...agent-deck/`) | §7.0 consumed-field contract |
| `pb_ai_codegen_prd`, `pb_product_principle` | Section scaffold, voice, scope discipline |
