# Decision: agent_deck's backend never calls an LLM directly

**Status:** Accepted  
**Date:** 2026-07-22  
**Related:** [PRD_FEEDBACK_ACCUMULATION.md](../PRD_FEEDBACK_ACCUMULATION.md), [2026-07-11-playbook-learning-loop-design.md](../superpowers/specs/2026-07-11-playbook-learning-loop-design.md)

---

## Context

Drafting the feedback-accumulation PRD, the first pass proposed a backend "Analyze feedback" endpoint that called the Anthropic API directly (`@anthropic-ai/sdk` in `packages/backend`) to batch-draft playbook patch ops from accumulated corrections.

Rejected: agent_deck's role in this ecosystem is capture, storage, and orchestration — MCP tool surface, REST API, dashboard, SQLite. Every other reasoning-heavy job in the system (IDE sessions, agent-dealer runs) is already done by an *external* agent (Claude Code, Cursor, Codex, agent-dealer's own Claude Code subprocess). Giving agent_deck's own backend a model client would introduce a second, inconsistent place reasoning happens, and a second dependency/credential surface (model API key) that doesn't fit its local-orchestration identity.

## Decision

**agent_deck's backend must never hold or call an LLM/model-provider SDK directly**, for any feature — including ones that look like they need "an LLM to summarize/analyze/draft something."

Instead: surface the relevant data (dashboard read, MCP read-only tool, REST GET) so a human or an external agent can pull it into their own session and reason over it there, then write results back through existing write/propose endpoints.

**Applied example (feedback-accumulation curation):** batch analysis is not a backend `/analyze` endpoint. It's the dashboard Feedback table (`/feedback-signals`: filter open/actioned/discarded by playbook, discard noise, "Copy for agent" with ids) that a human pastes into their IDE agent of choice; that agent drafts consolidated ops itself and submits via the existing `propose_playbook_patch` MCP tool with `signal_ids`. No new MCP list/discard tools were added either — capture/propose stays the only agent-facing surface for this data.

## Consequences

- No `@anthropic-ai/sdk`, OpenAI SDK, or equivalent as a `packages/backend` dependency, ever, for this class of feature.
- Any future PRD that wants agent_deck to "analyze" or "curate" something should default to the copy/paste-to-external-agent pattern above before considering a backend model call — treat a backend LLM call as the option to argue *against*, not toward.
- This is orthogonal to whether MCP-connected *services* (Slack, Linear, etc.) happen to be LLM products themselves — this decision is only about agent_deck's own backend process.
