import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { McpClient, SetupScope } from './mcp-config';

export const HARNESS_MARKER_START = '<!-- agent-deck:harness:start -->';
export const HARNESS_MARKER_END = '<!-- agent-deck:harness:end -->';
export const CURSOR_RULE_FILENAME = 'agent-deck.mdc';

/** One-line rule description (Cursor rule picker / skill-style discoverability). */
export const HARNESS_RULE_DESCRIPTION =
  'Agent Deck MCP — check decks for tools; playbooks for recipes; self-improve playbooks from feedback';

const GLOBAL_BODY = `Before declining for missing tools (Slack, Linear, GitHub, etc.), use agent-deck MCP: \`bind_workspace\`, \`list_bound_deck_services\`, \`call_service_tool\`. Don't hardcode deck IDs.

Deck playbooks are task recipes — \`list_playbooks\` / \`get_playbook\` (match \`triggers\`). Don't mirror into \`.cursor/skills/\` — one source of truth on the deck.

### Playbooks — refine from outcomes (self-improvement)

**When:** The user gives feedback on output you produced while following a bound-deck playbook — you called \`get_playbook\` this session and used its body/steps for that artifact. Use that session trace to identify the playbook; don't infer from playbook title, filename, or output type alone.

**Do both (default):**
1. Fix the **current output** per the user's feedback.
2. Call \`update_playbook\` on that same playbook so the **next** run avoids repeating the mistake.

**How to update the playbook:**
- **Generalize** — drop project-specific names, paths, and schemas; the playbook is reusable practice
- **Place the lesson** — checklist item for verification, technique for positive patterns, anti-pattern for mistakes to avoid
- **Restructure** if the playbook can't absorb the lesson cleanly — don't bolt it on
- **Surface the change** in your response so the user can audit drift`;

const PROJECT_BODY_EXTRA =
  'In this repo: \`bind_workspace\` with the workspace root. When a task matches deck playbooks (check \`triggers\` via \`list_playbooks\`), \`get_playbook\` before improvising.';

export function buildClaudeHarnessBlock(scope: SetupScope): string {
  const lines = ['## Agent Deck', '', GLOBAL_BODY];
  if (scope === 'project') {
    lines.push('', PROJECT_BODY_EXTRA);
  }
  return lines.join('\n');
}

function buildCursorHarnessInner(scope: SetupScope): string {
  const body =
    scope === 'project' ? `${GLOBAL_BODY}\n\n${PROJECT_BODY_EXTRA}` : GLOBAL_BODY;
  return `# Agent Deck\n\n${body}`;
}

const CURSOR_FRONTMATTER_REGEX = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

/** Merge only the agent-deck section; never replace other Cursor rules or skills. */
export function mergeCursorHarnessFile(
  existing: string,
  harnessInner: string,
  description: string = HARNESS_RULE_DESCRIPTION,
): { content: string; changed: boolean } {
  const wrapped = `${HARNESS_MARKER_START}\n${harnessInner}\n${HARNESS_MARKER_END}`;
  const frontmatterMatch = existing.match(CURSOR_FRONTMATTER_REGEX);
  const frontmatter = frontmatterMatch?.[0] ?? `---\ndescription: ${description}\nalwaysApply: true\n---\n\n`;
  const body = frontmatterMatch ? existing.slice(frontmatter.length) : existing;

  const start = body.indexOf(HARNESS_MARKER_START);
  const end = body.indexOf(HARNESS_MARKER_END);

  let nextBody: string;
  if (start !== -1 && end !== -1 && end > start) {
    const before = body.slice(0, start);
    const after = body.slice(end + HARNESS_MARKER_END.length);
    nextBody = `${before}${wrapped}${after}`;
  } else if (body.trim()) {
    nextBody = `${body.trimEnd()}\n\n${wrapped}\n`;
  } else {
    nextBody = `${wrapped}\n`;
  }

  const content = `${frontmatter}${nextBody}`.replace(/\n{3,}/g, '\n\n');
  const normalized = content.endsWith('\n') ? content : `${content}\n`;
  return { content: normalized, changed: normalized !== existing };
}

export function buildCursorHarnessFile(scope: SetupScope): string {
  return mergeCursorHarnessFile('', buildCursorHarnessInner(scope)).content;
}

export function mergeClaudeHarness(
  existing: string,
  harnessBlock: string,
): { content: string; changed: boolean } {
  const wrapped = `${HARNESS_MARKER_START}\n${harnessBlock}\n${HARNESS_MARKER_END}`;
  const start = existing.indexOf(HARNESS_MARKER_START);
  const end = existing.indexOf(HARNESS_MARKER_END);

  if (start !== -1 && end !== -1 && end > start) {
    const before = existing.slice(0, start);
    const after = existing.slice(end + HARNESS_MARKER_END.length);
    const content = `${before}${wrapped}${after}`.replace(/\n{3,}/g, '\n\n');
    return { content: content.endsWith('\n') ? content : `${content}\n`, changed: content !== existing };
  }

  const prefix = existing.trimEnd() ? `${existing.trimEnd()}\n\n` : '';
  const content = `${prefix}${wrapped}\n`;
  return { content, changed: true };
}

export function resolveHarnessPath(client: McpClient, scope: SetupScope): string | null {
  const home = os.homedir();
  const cwd = process.cwd();

  if (client === 'cursor') {
    const rulesDir =
      scope === 'project' ? path.join(cwd, '.cursor', 'rules') : path.join(home, '.cursor', 'rules');
    return path.join(rulesDir, CURSOR_RULE_FILENAME);
  }

  if (client === 'claude') {
    return scope === 'project' ? path.join(cwd, 'CLAUDE.md') : path.join(home, '.claude', 'CLAUDE.md');
  }

  return null;
}

export type HarnessInstallResult = {
  installed: boolean;
  path?: string;
  action?: 'created' | 'updated' | 'unchanged';
  message: string;
};

function readTextFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function writeTextFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
}

export function installAgentHarness(client: McpClient, scope: SetupScope): HarnessInstallResult {
  const harnessPath = resolveHarnessPath(client, scope);
  if (!harnessPath) {
    return {
      installed: false,
      message:
        'Agent harness applies to Cursor and Claude Code. For Claude Desktop, add the same snippets from docs/AGENT_HARNESS.md to your Claude Code global CLAUDE.md if you use both.',
    };
  }

  if (client === 'cursor') {
    const existing = readTextFile(harnessPath);
    const { content, changed } = mergeCursorHarnessFile(existing, buildCursorHarnessInner(scope));
    const action = !existing.trim() ? 'created' : changed ? 'updated' : 'unchanged';
    if (action !== 'unchanged') {
      writeTextFile(harnessPath, content);
    }
    return {
      installed: true,
      path: harnessPath,
      action,
      message:
        action === 'unchanged'
          ? `Agent harness already current → ${harnessPath}`
          : `Installed agent harness → ${harnessPath} (other rules/skills untouched)`,
    };
  }

  const block = buildClaudeHarnessBlock(scope);
  const existing = readTextFile(harnessPath);
  const { content, changed } = mergeClaudeHarness(existing, block);
  const action = !existing.trim() ? 'created' : changed ? 'updated' : 'unchanged';
  if (action !== 'unchanged') {
    writeTextFile(harnessPath, content);
  }

  return {
    installed: true,
    path: harnessPath,
    action,
    message:
      action === 'unchanged'
        ? `Agent harness already current → ${harnessPath}`
        : `Installed agent harness → ${harnessPath} (rest of CLAUDE.md untouched)`,
  };
}
