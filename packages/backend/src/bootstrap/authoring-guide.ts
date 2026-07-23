export const GUIDE_REF = 'pb_session_bootstrap_authoring';

export const AUTHORING_GUIDE_MARKDOWN = `# Session Bootstrap Authoring Guide (${GUIDE_REF})

Use these local session digests (Claude Code and/or Cursor) to propose reusable playbooks. Do not auto-register a playbook.

1. Read the manifest at the handoff path.
2. For the bound deck workspace, load matching digests:
   - \`workspaceRoot === boundRoot\` **or**
   - \`workspaceSlug === encodeCursorProjectSlug(boundRoot)\` (Unix: strip leading \`/\`, replace \`/\` and \`_\` with \`-\`)
   - Host is irrelevant for matching — Claude and Cursor digests for the same repo share \`workspaceSlug\`.
3. Cluster digests by task shape (not wording). \`host\` is a hint, not a hard split unless lessons clearly diverge.
4. Per cluster draft a playbook: triggers ← recurring \`intents\` (already unwrapped from Cursor \`<user_query>\` envelopes); Gotchas ← \`negative\` \`feedbackMoments\`; Techniques ← \`positive\`; generalize names and paths.
5. File only via \`propose_playbook_patch\` with \`kind: "create"\` and \`new_playbook: { title, triggers, body }\` — never \`register_playbook\`.
6. Multi-workspace: use one bound deck per run; re-bind and re-run authoring for other workspaces.
`;
