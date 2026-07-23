import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { enumerateCursorSessions } from './enumerate-cursor';

const temporaryPaths: string[] = [];

function makeTempDir(prefix: string): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryPaths.push(directory);
  return directory;
}

afterEach(() => {
  for (const temporaryPath of temporaryPaths.splice(0)) {
    fs.rmSync(temporaryPath, { recursive: true, force: true });
  }
});

describe('enumerateCursorSessions', () => {
  it('finds nested and flat jsonl and skips subagents', () => {
    const projects = makeTempDir('cursor-projects-');
    const slug = 'Users-x-proj';
    const root = path.join(projects, slug, 'agent-transcripts');
    const sessionDir = path.join(root, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    fs.mkdirSync(path.join(sessionDir, 'subagents'), { recursive: true });
    fs.writeFileSync(path.join(sessionDir, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jsonl'), '{}\n');
    fs.writeFileSync(path.join(sessionDir, 'subagents', 'sub-agent.jsonl'), '{}\n');
    fs.writeFileSync(path.join(root, 'legacy-flat.jsonl'), '{}\n');

    const sessions = enumerateCursorSessions(projects);
    expect(sessions.map((session) => session.sessionId).sort()).toEqual([
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      'legacy-flat',
    ]);
    expect(sessions.every((session) => session.projectSlug === slug)).toBe(true);
    expect(sessions.some((session) => session.filePath.includes('subagents'))).toBe(false);
  });

  it('skips empty-window and numeric junk project slugs', () => {
    const projects = makeTempDir('cursor-projects-');
    for (const slug of ['empty-window', '1768784650792', 'Users-x-real']) {
      const root = path.join(projects, slug, 'agent-transcripts');
      fs.mkdirSync(root, { recursive: true });
      fs.writeFileSync(path.join(root, 'sess.jsonl'), '{}\n');
    }

    const sessions = enumerateCursorSessions(projects);
    expect(sessions.map((session) => session.projectSlug)).toEqual(['Users-x-real']);
  });
});
