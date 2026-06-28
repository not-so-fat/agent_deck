---
id: hiring-feedback
triggers:
  - hiring feedback
  - send feedback
connections:
  - cred_ashby
  - cred_slack
exec: "agent-deck exec --connections cred_ashby,cred_slack -- uv run hiring feedback --dry-run"
---

# Hiring feedback

1. Confirm which candidate and stage the user means.
2. Run the hiring feedback CLI via Agent Deck exec.
3. Show the draft message; wait for explicit approval before posting to Slack.
