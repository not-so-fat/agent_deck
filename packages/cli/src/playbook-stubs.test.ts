import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  buildClaudeStubFile,
  buildCursorStubFile,
  buildStubDescription,
  readUseManifest,
  STUB_MARKER_END,
  STUB_MARKER_START_PREFIX,
  syncPlaybookStubs,
  writeUseManifest,
} from './playbook-stubs';

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-deck-use-'));
  tmpDirs.push(dir);
  return dir;
}

describe('playbook-stubs', () => {
  const playbook = {
    id: 'pb_hiring_inbox',
    title: 'Hiring Inbox',
    triggers: ['check inbox', 'triage candidates'],
  };

  it('builds cursor stub with triggers in description and pointer body', () => {
    const file = buildCursorStubFile(playbook);
    expect(file).toContain('description: check inbox, triage candidates');
    expect(file).toContain('alwaysApply: false');
    expect(file).toContain(`${STUB_MARKER_START_PREFIX} pb_hiring_inbox -->`);
    expect(file).toContain('get_playbook("pb_hiring_inbox")');
    expect(file).toContain('propose_playbook_patch');
    expect(file).toContain(STUB_MARKER_END);
    expect(file).not.toContain('weekly priority');
  });

  it('falls back to title when triggers are empty', () => {
    expect(buildStubDescription({ ...playbook, triggers: [] })).toBe('Hiring Inbox');
  });

  it('builds claude skill stub with name frontmatter', () => {
    const file = buildClaudeStubFile(playbook);
    expect(file).toContain('name: agent-deck-hiring-inbox');
    expect(file).toContain('description: check inbox, triage candidates');
  });

  it('sync creates stubs and removes retired playbooks', () => {
    const workspace = makeWorkspace();
    const first = syncPlaybookStubs(workspace, [playbook]);
    expect(first.cursor.created).toBe(1);
    expect(first.claude.created).toBe(1);

    const cursorPath = path.join(workspace, '.cursor', 'rules', 'agent-deck-stubs', 'pb_hiring_inbox.mdc');
    const claudePath = path.join(workspace, '.claude', 'skills', 'agent-deck-hiring-inbox', 'SKILL.md');
    expect(fs.existsSync(cursorPath)).toBe(true);
    expect(fs.existsSync(claudePath)).toBe(true);

    const other = {
      id: 'pb_retired',
      title: 'Retired',
      triggers: ['old'],
    };
    fs.mkdirSync(path.dirname(cursorStubPath(workspace, other.id)), { recursive: true });
    fs.writeFileSync(
      cursorStubPath(workspace, other.id),
      buildCursorStubFile(other),
    );
    fs.mkdirSync(path.join(workspace, '.claude', 'skills', 'agent-deck-retired'), { recursive: true });
    fs.writeFileSync(
      path.join(workspace, '.claude', 'skills', 'agent-deck-retired', 'SKILL.md'),
      buildClaudeStubFile(other),
    );

    const second = syncPlaybookStubs(workspace, [playbook]);
    expect(second.cursor.removed).toBe(1);
    expect(second.claude.removed).toBe(1);
    expect(fs.existsSync(cursorStubPath(workspace, 'pb_retired'))).toBe(false);
  });

  it('updates stub when triggers change', () => {
    const workspace = makeWorkspace();
    syncPlaybookStubs(workspace, [playbook]);
    const updated = syncPlaybookStubs(workspace, [
      { ...playbook, triggers: ['check inbox', 'new trigger'] },
    ]);
    expect(updated.cursor.updated).toBe(1);
    const content = fs.readFileSync(
      path.join(workspace, '.cursor', 'rules', 'agent-deck-stubs', 'pb_hiring_inbox.mdc'),
      'utf8',
    );
    expect(content).toContain('new trigger');
  });

  it('writes and reads use manifest', () => {
    const workspace = makeWorkspace();
    const manifest = {
      version: 1 as const,
      deckId: 'deck-1',
      deckName: 'dev',
      mcpUrl: 'http://127.0.0.1:1110/mcp',
      updatedAt: new Date().toISOString(),
    };
    writeUseManifest(workspace, manifest);
    expect(readUseManifest(workspace)).toEqual(manifest);
  });
});

function cursorStubPath(workspace: string, playbookId: string): string {
  return path.join(workspace, '.cursor', 'rules', 'agent-deck-stubs', `${playbookId}.mdc`);
}
