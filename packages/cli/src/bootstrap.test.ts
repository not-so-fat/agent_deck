import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runBootstrapCommand } from './bootstrap';
import { resolveBackendRoot } from './paths';

const temporaryPaths: string[] = [];

function makeTempDir(prefix: string): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryPaths.push(directory);
  return directory;
}

function copyFixture(projectsDir: string, workspaceDir: string, fixture: string, sessionId: string): void {
  const destination = path.join(projectsDir, workspaceDir);
  fs.mkdirSync(destination, { recursive: true });
  fs.copyFileSync(
    path.join(resolveBackendRoot(), 'src/bootstrap/fixtures', fixture),
    path.join(destination, `${sessionId}.jsonl`),
  );
}

afterEach(() => {
  for (const temporaryPath of temporaryPaths.splice(0)) {
    fs.rmSync(temporaryPath, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

describe('bootstrap CLI', () => {
  it('exits 0, writes bootstrap files, and prints the handoff', async () => {
    const projectsDir = makeTempDir('agent-deck-projects-');
    copyFixture(projectsDir, '-Users-x-proj', 'qa-only.jsonl', 'session-qa');
    const outDir = path.join(makeTempDir('agent-deck-out-parent-'), 'bootstrap');
    const homeDir = makeTempDir('agent-deck-home-');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(os, 'homedir').mockReturnValue(homeDir);

    const code = await runBootstrapCommand([
      '--projects-dir',
      projectsDir,
      '--out',
      outDir,
    ]);

    expect(error.mock.calls).toEqual([]);
    expect(code).toBe(0);
    expect(fs.existsSync(path.join(outDir, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'authoring-guide.md'))).toBe(true);
    expect(fs.readdirSync(path.join(outDir, 'digests')).length).toBeGreaterThanOrEqual(1);

    const stdout = log.mock.calls.map((call) => String(call[0])).join('\n');
    expect(stdout).toContain('--- agent-deck bootstrap handoff ---');
    expect(stdout).toContain('--- end handoff ---');
    expect(warn.mock.calls.map((call) => String(call[0])).join('\n')).toContain(
      'Warning: Only 1 sessions found; five or more are recommended.',
    );
  });
});
