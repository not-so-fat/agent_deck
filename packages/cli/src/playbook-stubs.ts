import fs from 'node:fs';
import path from 'node:path';

export const STUB_MARKER_START_PREFIX = '<!-- agent-deck:stub:start';
export const STUB_MARKER_END = '<!-- agent-deck:stub:end -->';

export const CURSOR_STUBS_DIR = 'agent-deck-stubs';
export const CLAUDE_SKILL_PREFIX = 'agent-deck-';

export type PlaybookStubInput = {
  id: string;
  title: string;
  triggers: string[];
};

export type StubSyncResult = {
  cursor: { created: number; updated: number; removed: number; dir: string };
  claude: { created: number; updated: number; removed: number; dirs: string[] };
};

export function slugFromPlaybook(title: string, id: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug) {
    return slug;
  }
  return id.replace(/^pb_/, '');
}

export function buildStubDescription(playbook: PlaybookStubInput): string {
  const fromTriggers = playbook.triggers.map((trigger) => trigger.trim()).filter(Boolean);
  if (fromTriggers.length > 0) {
    return fromTriggers.join(', ');
  }
  return playbook.title.trim() || playbook.id;
}

export function buildCursorStubFile(playbook: PlaybookStubInput): string {
  const description = buildStubDescription(playbook);
  const markerStart = `${STUB_MARKER_START_PREFIX} ${playbook.id} -->`;
  const body = [
    '---',
    `description: ${description}`,
    'alwaysApply: false',
    '---',
    '',
    markerStart,
    `# ${playbook.title}`,
    '',
    'Playbook body lives on the deck — **never** copy procedure steps into this file.',
    '',
    `1. \`bind_workspace\` if needed, then \`get_playbook("${playbook.id}")\` before following steps.`,
    '2. On user correction to playbook-shaped output: `propose_playbook_patch` with evidence (not `update_playbook` unless they directed an edit).',
    STUB_MARKER_END,
    '',
  ].join('\n');
  return body;
}

export function buildClaudeStubFile(playbook: PlaybookStubInput): string {
  const description = buildStubDescription(playbook);
  const markerStart = `${STUB_MARKER_START_PREFIX} ${playbook.id} -->`;
  const slug = slugFromPlaybook(playbook.title, playbook.id);
  return [
    '---',
    `name: ${CLAUDE_SKILL_PREFIX}${slug}`,
    `description: ${description}`,
    '---',
    '',
    markerStart,
    `# ${playbook.title}`,
    '',
    'Playbook body lives on the deck — **never** copy procedure steps into this file.',
    '',
    `1. \`bind_workspace\` if needed, then \`get_playbook("${playbook.id}")\` before following steps.`,
    '2. On user correction to playbook-shaped output: `propose_playbook_patch` with evidence (not `update_playbook` unless they directed an edit).',
    STUB_MARKER_END,
    '',
  ].join('\n');
}

function readText(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function writeText(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
}

function isAgentDeckStub(content: string): boolean {
  return content.includes(STUB_MARKER_START_PREFIX) && content.includes(STUB_MARKER_END);
}

function stubPlaybookId(content: string): string | null {
  const match = content.match(/<!-- agent-deck:stub:start\s+(\S+)\s+-->/);
  return match?.[1] ?? null;
}

function cursorStubPath(stubsDir: string, playbookId: string): string {
  return path.join(stubsDir, `${playbookId}.mdc`);
}

function claudeSkillDir(skillsRoot: string, playbook: PlaybookStubInput): string {
  return path.join(skillsRoot, `${CLAUDE_SKILL_PREFIX}${slugFromPlaybook(playbook.title, playbook.id)}`);
}

export type StubSyncOptions = {
  cursor?: boolean;
  claude?: boolean;
};

export function syncPlaybookStubs(
  workspaceRoot: string,
  playbooks: PlaybookStubInput[],
  options: StubSyncOptions = {},
): StubSyncResult {
  const writeCursor = options.cursor !== false;
  const writeClaude = options.claude !== false;
  const cursorDir = path.join(workspaceRoot, '.cursor', 'rules', CURSOR_STUBS_DIR);
  const claudeSkillsRoot = path.join(workspaceRoot, '.claude', 'skills');

  const result: StubSyncResult = {
    cursor: { created: 0, updated: 0, removed: 0, dir: cursorDir },
    claude: { created: 0, updated: 0, removed: 0, dirs: [] },
  };

  const expectedCursor = new Set(playbooks.map((playbook) => playbook.id));
  const expectedClaudeDirs = new Set(playbooks.map((playbook) => claudeSkillDir(claudeSkillsRoot, playbook)));

  if (fs.existsSync(cursorDir)) {
    for (const entry of fs.readdirSync(cursorDir)) {
      if (!writeCursor || !entry.endsWith('.mdc')) {
        continue;
      }
      const filePath = path.join(cursorDir, entry);
      const content = readText(filePath);
      if (!isAgentDeckStub(content)) {
        continue;
      }
      const playbookId = stubPlaybookId(content) ?? entry.replace(/\.mdc$/, '');
      if (!expectedCursor.has(playbookId)) {
        fs.unlinkSync(filePath);
        result.cursor.removed += 1;
      }
    }
  }

  if (fs.existsSync(claudeSkillsRoot)) {
    for (const entry of fs.readdirSync(claudeSkillsRoot, { withFileTypes: true })) {
      if (!writeClaude || !entry.isDirectory() || !entry.name.startsWith(CLAUDE_SKILL_PREFIX)) {
        continue;
      }
      const skillDir = path.join(claudeSkillsRoot, entry.name);
      const skillPath = path.join(skillDir, 'SKILL.md');
      const content = readText(skillPath);
      if (!isAgentDeckStub(content)) {
        continue;
      }
      if (!expectedClaudeDirs.has(skillDir)) {
        fs.rmSync(skillDir, { recursive: true, force: true });
        result.claude.removed += 1;
      }
    }
  }

  for (const playbook of playbooks) {
    if (writeCursor) {
      const cursorPath = cursorStubPath(cursorDir, playbook.id);
      const nextCursor = buildCursorStubFile(playbook);
      const prevCursor = readText(cursorPath);
      if (!prevCursor.trim()) {
        writeText(cursorPath, nextCursor);
        result.cursor.created += 1;
      } else if (prevCursor !== nextCursor) {
        writeText(cursorPath, nextCursor);
        result.cursor.updated += 1;
      }
    }

    if (writeClaude) {
      const skillDir = claudeSkillDir(claudeSkillsRoot, playbook);
      const skillPath = path.join(skillDir, 'SKILL.md');
      const nextClaude = buildClaudeStubFile(playbook);
      const prevClaude = readText(skillPath);
      if (!prevClaude.trim()) {
        writeText(skillPath, nextClaude);
        result.claude.created += 1;
        result.claude.dirs.push(skillDir);
      } else if (prevClaude !== nextClaude) {
        writeText(skillPath, nextClaude);
        result.claude.updated += 1;
        result.claude.dirs.push(skillDir);
      } else {
        result.claude.dirs.push(skillDir);
      }
    }
  }

  return result;
}

export type UseManifest = {
  version: 1;
  deckId: string;
  deckName: string;
  mcpUrl: string;
  updatedAt: string;
};

export const USE_MANIFEST_PATH = '.agent-deck/use.json';

export function readUseManifest(workspaceRoot: string): UseManifest | null {
  const manifestPath = path.join(workspaceRoot, USE_MANIFEST_PATH);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as UseManifest;
    if (parsed?.version === 1 && typeof parsed.deckId === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeUseManifest(workspaceRoot: string, manifest: UseManifest): string {
  const manifestPath = path.join(workspaceRoot, USE_MANIFEST_PATH);
  writeText(manifestPath, JSON.stringify(manifest, null, 2));
  return manifestPath;
}
