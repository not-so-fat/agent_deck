---
playbooks: pb_ai_codegen_prd, pb_product_principle
---

# Export / import — AI Codegen PRD

**One-liner:** Users can move their full Agent Deck connection graph to another machine in one local bundle, with optional encrypted secrets and preserved deck UUIDs so repo manifests keep working.

**Status:** Proposed · **Codegen load path:** `docs/PRD_EXPORT_IMPORT.md` · **Contracts:** `packages/shared/src/schemas/export-bundle.ts` (Zod + exported JSON Schema)

---

## 1. Product overview

Agent Deck stores MCP services, API keys, playbooks, and deck layouts in a local SQLite + Keychain graph (`~/.agent-deck/`). Today users can only copy a `.agent-deck/deck.yaml` snippet (`deck_id` + name) — that assumes the target machine already has the same database. Chi raised the need to **port the whole environment** when switching laptops.

This PRD specifies a **local-only** `.agent-deck-bundle` format, CLI + REST export/import, and a phased dashboard UI. It replaces v1 **Import Deck** (removed in MVP) with a design aligned to the card/deck/collection model.

**Success criteria (time-boxed):**

| # | Criterion | Target window |
|---|-----------|---------------|
| SC-1 | Metadata-only round-trip restores equivalent dashboard layout on a second machine | Phase 4a ship |
| SC-2 | Encrypted-secret round-trip: API keys work without re-entry | Phase 4b ship |
| SC-3 | Repo `deck.yaml` with preserved `deck_id` binds on target after import | Phase 4a |
| SC-4 | Metadata-only bundle + import report lists every reconnect / re-enter gap | Phase 4a |

---

## 2. Target users & roles

| Persona | Goal | v1 surface |
|---------|------|------------|
| **Solo dev** (Chi) | New laptop; restore decks + keys | CLI `export` / `import`, encrypted secrets |
| **Solo dev** | Pre-upgrade backup | CLI metadata export |
| **Team lead** | Share deck layout without secrets | CLI `--deck` + `--no-secrets` |
| **Agent (MCP)** | Assist migration after user confirms | `export_bundle` / `import_bundle` (P2) |
| **Support / self** | Understand import gaps | Import report JSON |

**Voice:** Objective, cold-reader — assume reader has never seen Agent Deck internals. Link [MVP.md](./MVP.md) for bound-deck terminology; do not re-teach Modules 1–3.

---

## 3. User stories (testable)

### US-1 — Full laptop migration (metadata)

**As a** solo dev **I want** to export my collection and all decks **so that** I can import on a new machine without rebuilding layouts.

**Acceptance:**

- [ ] `agent-deck export --output backup.agent-deck-bundle` produces a zip the CLI accepts on another host
- [ ] After `agent-deck import backup.agent-deck-bundle`, dashboard shows the same deck names and card membership order
- [ ] Import report lists each `cred_*` missing a secret value
- [ ] Import report lists each MCP card needing OAuth reconnect

*v1 · Phase 4a*

### US-2 — Full laptop migration (secrets)

**As a** solo dev **I want** to include encrypted API keys and OAuth tokens in the bundle **so that** scripts and MCP connections work immediately after import.

**Acceptance:**

- [ ] `agent-deck export --secrets --passphrase` never writes plaintext secrets to disk outside Keychain
- [ ] Import with matching passphrase writes secrets to target Keychain / dev file store
- [ ] `agent-deck exec --connections cred_x` succeeds for imported creds without re-entry

*v1 · Phase 4b*

### US-3 — Repo manifest compatibility

**As a** dev with repos containing `.agent-deck/deck.yaml` **I want** imported decks to keep the same UUID **so that** I do not edit every repo.

**Acceptance:**

- [ ] Default export sets `preserve_ids: true`
- [ ] Import upserts entities with original `deck_id`, `cred_*`, `pb_*`, service UUIDs
- [ ] `bind_workspace` on target resolves manifest `deck_id` to the imported deck

*v1 · Phase 4a*

### US-4 — Shareable deck template

**As a** team lead **I want** to export one deck without secrets **so that** teammates get the layout and reconnect their own keys.

**Acceptance:**

- [ ] `agent-deck export --deck <uuid> --no-secrets` includes dependency closure (linked MCPs, cred metadata, playbooks)
- [ ] Bundle contains zero secret bytes
- [ ] Importer sees checklist only — no false “authenticated” OAuth state

*v1 · Phase 4d*

### US-5 — Dashboard import wizard

**As a** non-CLI user **I want** drag-drop import with a preview **so that** I understand what will change.

**Acceptance:**

- [ ] Import modal shows created / updated / skipped counts before apply
- [ ] Passphrase field appears when bundle contains encrypted secrets blob
- [ ] Post-import modal matches CLI report schema

*Deferred · Phase 4c*

---

## 4. Features & requirements

### Pillar A — Bundle format

| Req ID | Requirement | Acceptance |
|--------|-------------|------------|
| F1.1 | Bundle is a zip with `manifest.yaml` + JSON payload files | Validator rejects missing `format: agent-deck-bundle` |
| F1.2 | Support scopes `full`, `collection`, `deck` | `deck` scope includes dependency closure per US-4 |
| F1.3 | `preserve_ids` defaults true | Manifest documents flag; import honors it |
| F1.4 | Exclude `exec_runs`, session binding, harness files | Not present in bundle |
| F1.5 | Icon cache excluded; re-fetch on import | No `icons/` directory in bundle |

### Pillar B — Secrets

| Req ID | Requirement | Acceptance |
|--------|-------------|------------|
| F2.1 | Metadata-only export is default | CLI flag `--no-secrets` implicit |
| F2.2 | Encrypted export uses AES-256-GCM + user passphrase | `secrets.enc` blob in bundle; no plaintext |
| F2.3 | Import without secrets sets `has_secret: false`, `oauth_has_token: false` | Dashboard shows enter-key / reconnect |
| F2.4 | Never write unencrypted secrets to bundle | Unit test fails if plaintext key detected in zip |

### Pillar C — Import strategies

| Req ID | Requirement | Acceptance |
|--------|-------------|------------|
| F3.1 | Merge (default): upsert by id, warn on conflict | Report `skipped` with reason |
| F3.2 | Replace deck: recreate one deck membership from bundle | `--replace-deck <uuid>` |
| F3.3 | Fresh import: only when target empty or `--force` | Confirmation prompt |
| F3.4 | Post-import report matches `ImportReport` schema (§7.2) | CLI and API return same shape |

### Pillar D — Surfaces

| Req ID | Requirement | Acceptance |
|--------|-------------|------------|
| F4.1 | CLI `export` and `import` subcommands | `packages/cli/src/index.ts` |
| F4.2 | `POST /api/export` streams zip | Dashboard header `x-agent-deck-client: dashboard` |
| F4.3 | `POST /api/import` multipart + report JSON | Secrets never logged |
| F4.4 | Dashboard export/import entry points | My Collection + My Decks row menu |
| F4.5 | MCP `export_bundle` / `import_bundle` | Metadata-only default; import requires dashboard confirm if secrets |

---

## 5. Pricing model

*Skipped — Agent Deck does not host, proxy, or bill third-party APIs in this feature.*

---

## 6. Design principles

| Principle | Load-bearing requirement |
|-----------|-------------------------|
| Local-only | No upload to Agent Deck servers (F2.4, security review) |
| ID stability | `preserve_ids` default true (F1.3, US-3) |
| Honest gaps | Import report is the product for partial migration (F3.4) |
| Replace v1 Import Deck | Do not restore old dashboard Import Deck UI |

---

## 7. Cross-cutting contracts

All schemas: **JSON Schema Draft 2020-12**. Implementation: Zod in `packages/shared/src/schemas/export-bundle.ts` with `zod-to-json-schema` export for docs/tests.

### 7.1 Bundle manifest (`manifest.yaml`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://agent-deck.dev/schemas/bundle-manifest/v1.json",
  "type": "object",
  "required": ["format", "version", "exported_at", "exported_from", "options", "preserve_ids"],
  "properties": {
    "format": { "const": "agent-deck-bundle" },
    "version": { "const": 1 },
    "exported_at": { "type": "string", "format": "date-time" },
    "exported_from": {
      "type": "object",
      "required": ["agent_deck_version", "home"],
      "properties": {
        "agent_deck_version": { "type": "string" },
        "home": { "type": "string" }
      }
    },
    "options": {
      "type": "object",
      "required": ["include_secrets", "scope"],
      "properties": {
        "include_secrets": { "type": "boolean" },
        "scope": { "enum": ["full", "collection", "deck"] },
        "deck_ids": { "type": "array", "items": { "type": "string", "format": "uuid" } }
      }
    },
    "preserve_ids": { "type": "boolean" }
  }
}
```

### 7.2 Import report (`ImportReport`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://agent-deck.dev/schemas/import-report/v1.json",
  "type": "object",
  "required": ["status", "counts", "credentials_needing_secret", "services_needing_oauth", "warnings"],
  "properties": {
    "status": { "enum": ["completed", "failed", "partial"] },
    "counts": {
      "type": "object",
      "properties": {
        "created": { "type": "integer" },
        "updated": { "type": "integer" },
        "skipped": { "type": "integer" }
      }
    },
    "credentials_needing_secret": { "type": "array", "items": { "type": "string" } },
    "services_needing_oauth": { "type": "array", "items": { "type": "string" } },
    "broken_playbook_deps": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "playbook_id": { "type": "string" },
          "missing_ref": { "type": "string" }
        }
      }
    },
    "warnings": { "type": "array", "items": { "type": "string" } },
    "id_map": {
      "type": "object",
      "additionalProperties": { "type": "string" },
      "description": "Present only when preserve_ids false"
    }
  }
}
```

### 7.3 Export API request (`ExportRequest`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://agent-deck.dev/schemas/export-request/v1.json",
  "type": "object",
  "required": ["scope"],
  "properties": {
    "scope": { "enum": ["full", "collection", "deck"] },
    "deckIds": { "type": "array", "items": { "type": "string", "format": "uuid" } },
    "includeSecrets": { "type": "boolean", "default": false },
    "passphrase": { "type": "string", "minLength": 8, "description": "Required when includeSecrets true" }
  }
}
```

### 7.4 MCP `export_bundle` input

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `scope` | `full` \| `collection` \| `deck` | yes | |
| `deck_id` | uuid | when scope=deck | |
| `include_secrets` | boolean | no | default false; agent cannot set true without user passphrase flow |

---

## 8. Technical constraints & preferences

| Constraint | Detail |
|------------|--------|
| **Stack** | TypeScript monorepo; Fastify API; `packages/cli`; Zod validation |
| **Data home** | `resolveAgentDeckHome()` — prod `~/.agent-deck/`, dev `~/.agent-deck/dev/` |
| **Secrets** | macOS Keychain + dev file store (`packages/backend/src/vault/secret-store.ts`) |
| **SQLite tables** | `services`, `decks`, `deck_*`, `credentials`, `playbooks` |
| **As-built gap** | Manifest copy only: `deck-management-panel.tsx` `handleCopyManifest` |
| **Codegen entry** | Implement from this PRD; tests in `packages/backend/src/export-import/` |

**CLI commands (normative):**

```bash
agent-deck export --output <path> [--secrets] [--passphrase] [--deck <uuid>] [--no-secrets]
agent-deck import <path> [--secrets] [--merge] [--replace-deck <uuid>] [--force]
```

**Agent hook:** Reference this PRD from `.cursor/rules/` or project `CLAUDE.md` when implementing export/import.

---

## 9. Non-functional requirements

| NFR | Target | Measurement |
|-----|--------|-------------|
| NFR-1 Export latency (full collection, 50 cards, metadata-only) | p95 < 5 s | Local benchmark; n ≥ 20 runs on M-series Mac |
| NFR-2 Import latency (same bundle) | p95 < 10 s | Same |
| NFR-3 Bundle size (metadata-only, 50 cards) | < 5 MB | Excludes secrets blob |
| NFR-4 Secret safety | 0 plaintext secrets in metadata export | Automated zip content scan in CI |
| NFR-5 Forward compatibility | Reject unknown `version` with actionable error | Integration test |

---

## 10. Out of scope

Canonical list — other sections defer here.

| Item | Rationale |
|------|-----------|
| Cloud sync / multi-user replication | [MVP.md](./MVP.md) non-goals |
| Git-tracked skills, app code, repo `roles/` | User owns in git |
| Auto-fix OAuth redirect URIs on new host | User reconnects; report lists gaps |
| Pre-MVP v1 import format | Separate migration spike |
| `exec_runs` history in bundle | Audit noise; optional future appendix |
| Icon cache in bundle | Re-fetch favicons (F1.5) |
| Signed / team attestation bundles | Open decision OD-2 |

---

## 11. Milestones

| Week | Exit criteria |
|------|---------------|
| **4a** | Zod schemas; backend export/import service; CLI metadata-only; round-trip tests; SC-1, SC-3, SC-4 |
| **4b** | Encrypted `secrets.enc`; passphrase flow; SC-2 |
| **4c** | Dashboard wizard; US-5 acceptance |
| **4d** | Deck-scoped export; MCP tools F4.5; US-4 |

---

## 12. Open decisions

| Question | Default if undecided | Owner |
|----------|----------------------|-------|
| OD-1 Import bundle from older Agent Deck on newer host? | Reader accepts `version: 1` only; ship migration adapter when v2 needed | Eng |
| OD-2 Signed bundles for team sharing? | Defer; metadata-only git-committed bundles | Product |
| OD-3 Embed `id_map.json` in bundle on conflict? | Emit only in `ImportReport`; never silent remap | Eng |

---

## 13. How to use this PRD

| Consumer | Directive |
|----------|-----------|
| **Engineer** | Implement pillars in order A → B → C → D; land 4a before 4b. Req IDs in PR comments. |
| **AI codegen** | Read §7 schemas first; generate `export-bundle.ts` + `export-import-service.ts` + CLI wiring; run round-trip tests before dashboard UI. |
| **Reviewer** | Trace each US-* to Req IDs and tests; verify Out of scope not re-introduced. |
| **User (migration)** | Phase 4a: export → copy file → import → follow report checklist for keys and OAuth. |

---

## Appendix — source notes

| Source | Captured as |
|--------|-------------|
| Agent Deck playbook `pb_ai_codegen_prd` on **dev** deck (`~/.agent-deck/`) | This document structure |
| Agent Deck playbook `pb_product_principle` | Voice, scope discipline, substrate-first |
| Chi — port env to another computer | US-1, US-2 |
| [MVP.md](./MVP.md) as-built; Import Deck removed | §1, §10 |
| `packages/backend/src/lib/paths.ts` | §8 data home |
| `packages/backend/src/vault/yaml-sync.ts`, `secret-store.ts` | §8 secrets |
| [PLAYBOOKS_AND_SKILLS.md](./PLAYBOOKS_AND_SKILLS.md) export/sync mention | Related future; not v1 |

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
- [x] MCP `export_bundle` input shape committed (§7.4)
- [x] Pricing section skipped with justification (§5)
