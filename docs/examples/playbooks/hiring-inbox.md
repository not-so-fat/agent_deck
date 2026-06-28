---
id: hiring-inbox
triggers:
  - check inbox
  - review applicants
  - hiring inbox
connections:
  - cred_ashby
  - cred_openai
  - cred_slack
exec: "agent-deck exec --connections cred_ashby,cred_openai,cred_slack -- uv run hiring inbox --dry-run"
skill: .claude/skills/hiring/SKILL.md
---

# Hiring inbox

1. Run the hiring CLI via Agent Deck exec (connections above).
2. Walk results worst-tier first; user confirms each write.
3. Do not skip `--dry-run` until user says otherwise.

Domain calibration lives in repo `roles/` — not duplicated here.
