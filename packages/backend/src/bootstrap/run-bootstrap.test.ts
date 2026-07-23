import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BootstrapManifestSchema } from '@agent-deck/shared';
import { formatBootstrapOutput, formatHandoffBlock } from './handoff';
import { runBootstrap } from './run-bootstrap';

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
    path.join(__dirname, 'fixtures', fixture),
    path.join(destination, `${sessionId}.jsonl`),
  );
}

afterEach(() => {
  for (const temporaryPath of temporaryPaths.splice(0)) {
    fs.rmSync(temporaryPath, { recursive: true, force: true });
  }
});

describe('runBootstrap', () => {
  it('writes digests, manifest, guide, latest pointer, and formatted handoff', () => {
    const projectsDir = makeTempDir('agent-deck-projects-');
    const bootstrapRoot = makeTempDir('agent-deck-bootstrap-');
    copyFixture(projectsDir, '-Users-x-proj', 'qa-only.jsonl', 'session-qa');
    copyFixture(projectsDir, '-Users-x-other', 'feedback-negative.jsonl', 'session-feedback');

    const result = runBootstrap({
      projectsDir,
      bootstrapRoot,
      now: () => new Date('2026-07-22T12:00:00.000Z'),
    });

    expect(fs.existsSync(result.manifestPath)).toBe(true);
    expect(fs.existsSync(result.guidePath)).toBe(true);
    expect(fs.readFileSync(path.join(bootstrapRoot, 'latest'), 'utf8')).toBe(`${result.outDir}\n`);
    expect(fs.lstatSync(path.join(bootstrapRoot, 'latest')).isSymbolicLink()).toBe(false);
    expect(fs.readdirSync(path.join(result.outDir, 'digests'))).toHaveLength(2);

    const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8'));
    expect(BootstrapManifestSchema.safeParse(manifest).success).toBe(true);
    expect(manifest.guideRef).toBe(result.guidePath);
    expect(fs.readFileSync(result.guidePath, 'utf8')).toContain('pb_session_bootstrap_authoring');
    expect(formatHandoffBlock(result)).toBe(
      `--- agent-deck bootstrap handoff ---\n` +
        `1. Load the authoring guide: ${result.guidePath}\n` +
        `   (guideRef: pb_session_bootstrap_authoring)\n` +
        `2. Read the manifest: ${result.manifestPath}\n` +
        `3. Bind the workspace you are in, then propose playbooks for the bound deck only\n` +
        `   (load digests whose workspaceRoot matches; hold others).\n` +
        `--- end handoff ---`,
    );
    expect(formatBootstrapOutput(result)).toBe(
      `Note: digests include verbatim user-reaction excerpts. Parsing is local; digests enter your agent context when authoring.\n` +
        formatHandoffBlock(result),
    );
  });

  it('replaces a legacy latest symlink with a regular pointer file', () => {
    const projectsDir = makeTempDir('agent-deck-projects-');
    const bootstrapRoot = makeTempDir('agent-deck-bootstrap-');
    const legacyTarget = makeTempDir('agent-deck-legacy-');
    fs.symlinkSync(legacyTarget, path.join(bootstrapRoot, 'latest'));
    copyFixture(projectsDir, '-Users-x-proj', 'qa-only.jsonl', 'session-qa');

    const result = runBootstrap({
      projectsDir,
      bootstrapRoot,
      now: () => new Date('2026-07-22T12:00:00.000Z'),
    });

    const latestPath = path.join(bootstrapRoot, 'latest');
    expect(fs.lstatSync(latestPath).isSymbolicLink()).toBe(false);
    expect(fs.readFileSync(latestPath, 'utf8')).toBe(`${result.outDir}\n`);
  });

  it('creates a unique timestamped directory and updates latest on a second run', () => {
    const projectsDir = makeTempDir('agent-deck-projects-');
    const bootstrapRoot = makeTempDir('agent-deck-bootstrap-');
    copyFixture(projectsDir, '-Users-x-proj', 'qa-only.jsonl', 'session-qa');

    const first = runBootstrap({
      projectsDir,
      bootstrapRoot,
      now: () => new Date('2026-07-22T12:00:00.000Z'),
    });
    const second = runBootstrap({
      projectsDir,
      bootstrapRoot,
      now: () => new Date('2026-07-22T12:00:01.000Z'),
    });

    expect(second.outDir).not.toBe(first.outDir);
    expect(fs.existsSync(first.outDir)).toBe(true);
    expect(fs.readFileSync(path.join(bootstrapRoot, 'latest'), 'utf8')).toBe(`${second.outDir}\n`);
  });
});
