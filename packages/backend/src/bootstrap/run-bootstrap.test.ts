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
      host: 'claude',
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
    expect(manifest.hosts).toEqual({ claude: 2, cursor: 0 });
    expect(fs.readFileSync(result.guidePath, 'utf8')).toContain('encodeCursorProjectSlug');
    const digest = JSON.parse(
      fs.readFileSync(path.join(result.outDir, 'digests', fs.readdirSync(path.join(result.outDir, 'digests'))[0]), 'utf8'),
    );
    expect(digest.host).toBe('claude');
    expect(formatHandoffBlock(result)).toBe(
      `--- agent-deck bootstrap handoff ---\n` +
        `1. Load the authoring guide: ${result.guidePath}\n` +
        `   (guideRef: pb_session_bootstrap_authoring)\n` +
        `2. Read the manifest: ${result.manifestPath}\n` +
        `3. Bind the workspace you are in, then propose playbooks for the bound deck only\n` +
        `   (load digests whose workspaceRoot or workspaceSlug matches; hold others).\n` +
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
      host: 'claude',
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
      host: 'claude',
      projectsDir,
      bootstrapRoot,
      now: () => new Date('2026-07-22T12:00:00.000Z'),
    });
    const second = runBootstrap({
      host: 'claude',
      projectsDir,
      bootstrapRoot,
      now: () => new Date('2026-07-22T12:00:01.000Z'),
    });

    expect(second.outDir).not.toBe(first.outDir);
    expect(fs.existsSync(first.outDir)).toBe(true);
    expect(fs.readFileSync(path.join(bootstrapRoot, 'latest'), 'utf8')).toBe(`${second.outDir}\n`);
  });

  it('defaults bootstrapRoot under AGENT_DECK_HOME, not ~/.claude', () => {
    const home = makeTempDir('agent-deck-home-');
    const projectsDir = makeTempDir('agent-deck-projects-');
    copyFixture(projectsDir, '-Users-x-proj', 'qa-only.jsonl', 'session-qa');
    const previousHome = process.env.AGENT_DECK_HOME;
    process.env.AGENT_DECK_HOME = home;
    try {
      const result = runBootstrap({
        host: 'claude',
        projectsDir,
        now: () => new Date('2026-07-22T14:00:00.000Z'),
      });
      expect(result.outDir.startsWith(path.join(home, 'bootstrap'))).toBe(true);
      expect(result.outDir.includes(`${path.sep}.claude${path.sep}`)).toBe(false);
      expect(fs.readFileSync(path.join(home, 'bootstrap', 'latest'), 'utf8')).toBe(`${result.outDir}\n`);
    } finally {
      if (previousHome === undefined) {
        delete process.env.AGENT_DECK_HOME;
      } else {
        process.env.AGENT_DECK_HOME = previousHome;
      }
    }
  });

  it('mines cursor agent-transcripts with --host cursor and workspace slug match', () => {
    const cursorProjects = makeTempDir('cursor-projects-');
    const bootstrapRoot = makeTempDir('agent-deck-bootstrap-');
    const workspace = '/Users/x/proj';
    const slug = 'Users-x-proj';
    const sessionDir = path.join(
      cursorProjects,
      slug,
      'agent-transcripts',
      '11111111-2222-3333-4444-555555555555',
    );
    fs.mkdirSync(path.join(sessionDir, 'subagents'), { recursive: true });
    fs.copyFileSync(
      path.join(__dirname, 'fixtures', 'cursor-with-tools.jsonl'),
      path.join(sessionDir, '11111111-2222-3333-4444-555555555555.jsonl'),
    );
    fs.writeFileSync(path.join(sessionDir, 'subagents', 'sub.jsonl'), '{"role":"user"}\n');

    const result = runBootstrap({
      host: 'cursor',
      cursorProjectsDir: cursorProjects,
      claudeProjectsDir: makeTempDir('empty-claude-'),
      bootstrapRoot,
      workspace,
      now: () => new Date('2026-07-22T13:00:00.000Z'),
    });

    expect(result.manifest.totalSessions).toBe(1);
    expect(result.manifest.hosts).toEqual({ claude: 0, cursor: 1 });
    const digests = fs.readdirSync(path.join(result.outDir, 'digests'));
    expect(digests).toHaveLength(1);
    const digest = JSON.parse(fs.readFileSync(path.join(result.outDir, 'digests', digests[0]), 'utf8'));
    expect(digest.host).toBe('cursor');
    expect(digest.workspaceRoot).toBe(workspace);
    expect(digest.workspaceSlug).toBe(slug);
    expect(digest.intents.every((intent: { text: string }) => !intent.text.includes('<user_query>'))).toBe(
      true,
    );
    expect(digest.feedbackMoments.length).toBe(1);
    expect(digest.feedbackMoments[0].userReaction).not.toContain('Briefly inform');
  });

  it('applies --limit to newest sessions by mtime, not alphabetical path order', () => {
    const projectsDir = makeTempDir('agent-deck-projects-');
    const bootstrapRoot = makeTempDir('agent-deck-bootstrap-');
    // Alphabetically first workspace would win without mtime sort.
    copyFixture(projectsDir, '-Users-a-old', 'qa-only.jsonl', 'session-old');
    copyFixture(projectsDir, '-Users-z-new', 'qa-only.jsonl', 'session-new');
    const oldPath = path.join(projectsDir, '-Users-a-old', 'session-old.jsonl');
    const newPath = path.join(projectsDir, '-Users-z-new', 'session-new.jsonl');
    const oldTime = new Date('2020-01-01T00:00:00.000Z');
    const newTime = new Date('2026-07-22T12:00:00.000Z');
    fs.utimesSync(oldPath, oldTime, oldTime);
    fs.utimesSync(newPath, newTime, newTime);

    const result = runBootstrap({
      host: 'claude',
      projectsDir,
      bootstrapRoot,
      limit: 1,
      now: () => new Date('2026-07-22T15:00:00.000Z'),
    });

    expect(result.manifest.totalSessions).toBe(1);
    const digests = fs.readdirSync(path.join(result.outDir, 'digests'));
    expect(digests).toHaveLength(1);
    expect(digests[0]).toContain('session-new');
    expect(digests[0]).not.toContain('session-old');
  });
});
