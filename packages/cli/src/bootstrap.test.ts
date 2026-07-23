import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runBootstrapCommand } from './bootstrap';

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
  vi.restoreAllMocks();
});

describe('bootstrap CLI', () => {
  it('exits 0, writes bootstrap files, and prints the handoff', async () => {
    const projectsDir = makeTempDir('agent-deck-projects-');
    const outDir = path.join(makeTempDir('agent-deck-out-parent-'), 'bootstrap');
    const homeDir = makeTempDir('agent-deck-home-');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
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
    expect(log.mock.calls.join('\n')).toContain('--- end handoff ---');
  });
});
