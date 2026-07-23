import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  BootstrapManifestSchema,
  resolveAgentDeckHome,
  type BootstrapHost,
  type BootstrapManifest,
  type SessionDigest,
} from '@agent-deck/shared';
import { AUTHORING_GUIDE_MARKDOWN } from './authoring-guide';
import { encodeCursorProjectSlug } from './cursor-project-slug';
import { digestCursorSession } from './digest-cursor-session';
import { digestSession } from './digest-session';
import { enumerateCursorSessions } from './enumerate-cursor';
import { enumerateSessions } from './enumerate';

export type BootstrapHostOption = BootstrapHost | 'all';

export type BootstrapOptions = {
  /** @deprecated Prefer claudeProjectsDir — kept for CLI --projects-dir compat (Claude tree). */
  projectsDir?: string;
  claudeProjectsDir?: string;
  cursorProjectsDir?: string;
  host?: BootstrapHostOption;
  outDir?: string;
  bootstrapRoot?: string;
  workspace?: string;
  since?: string;
  limit?: number;
  now?: () => Date;
};

export type BootstrapResult = {
  outDir: string;
  manifestPath: string;
  guidePath: string;
  latestPointerPath: string;
  manifest: BootstrapManifest;
  warning?: string;
};

type DigestRecord = {
  digest: SessionDigest;
  mtimeMs: number;
};

export function runBootstrap(options: BootstrapOptions = {}): BootstrapResult {
  const now = options.now ?? (() => new Date());
  const host = options.host ?? 'all';
  const claudeProjectsDir = path.resolve(
    options.claudeProjectsDir ??
      options.projectsDir ??
      process.env.AGENT_DECK_CLAUDE_PROJECTS_DIR ??
      path.join(os.homedir(), '.claude', 'projects'),
  );
  const cursorProjectsDir = path.resolve(
    options.cursorProjectsDir ??
      process.env.AGENT_DECK_CURSOR_PROJECTS_DIR ??
      path.join(os.homedir(), '.cursor', 'projects'),
  );
  // Host-agnostic Agent Deck data root (same home as DB / logs), not under ~/.claude.
  const bootstrapRoot = path.resolve(
    options.bootstrapRoot ?? path.join(resolveAgentDeckHome(), 'bootstrap'),
  );
  const outDir = resolveOutDir(options.outDir, bootstrapRoot, now);
  const since = parseSince(options.since);
  const workspace = options.workspace ? path.resolve(options.workspace) : undefined;
  const limit = normalizeLimit(options.limit);

  if (fs.existsSync(outDir)) {
    throw new Error(`Bootstrap output already exists: ${outDir}`);
  }

  const digests: DigestRecord[] = [];

  if (host === 'claude' || host === 'all') {
    for (const session of enumerateSessions(claudeProjectsDir)) {
      digests.push({
        digest: digestSession(session.sessionId, readJsonLines(session.filePath)),
        mtimeMs: session.mtimeMs,
      });
    }
  }

  if (host === 'cursor' || host === 'all') {
    const cursorSlug = workspace ? encodeCursorProjectSlug(workspace) : undefined;
    for (const session of enumerateCursorSessions(cursorProjectsDir)) {
      if (cursorSlug && session.projectSlug !== cursorSlug) {
        continue;
      }
      digests.push({
        digest: digestCursorSession(session.sessionId, readJsonLines(session.filePath), session.projectSlug, {
          ...(workspace && session.projectSlug === cursorSlug ? { workspaceRoot: workspace } : {}),
        }),
        mtimeMs: session.mtimeMs,
      });
    }
  }

  const filtered = digests
    .filter(({ digest, mtimeMs }) => matchesFilters(digest, mtimeMs, workspace, since))
    .slice(0, limit);

  const digestDir = path.join(outDir, 'digests');
  fs.mkdirSync(digestDir, { recursive: true });

  const digestPaths = new Map<SessionDigest, string>();
  const filenameCounts = new Map<string, number>();
  for (const { digest } of filtered) {
    const filename = uniqueDigestFilename(digest, filenameCounts);
    const digestPath = path.join(digestDir, filename);
    fs.writeFileSync(digestPath, `${JSON.stringify(digest, null, 2)}\n`, 'utf8');
    digestPaths.set(digest, digestPath);
  }

  const guidePath = path.join(outDir, 'authoring-guide.md');
  fs.writeFileSync(guidePath, AUTHORING_GUIDE_MARKDOWN, 'utf8');

  const hosts = {
    claude: filtered.filter(({ digest }) => digest.host === 'claude').length,
    cursor: filtered.filter(({ digest }) => digest.host === 'cursor').length,
  };

  const manifest = BootstrapManifestSchema.parse({
    schemaVersion: 1,
    generatedAt: now().toISOString(),
    digestDir,
    guideRef: guidePath,
    totalSessions: filtered.length,
    hosts,
    workspaces: buildWorkspaces(filtered, digestPaths),
  });
  const manifestPath = path.join(outDir, 'manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  fs.mkdirSync(bootstrapRoot, { recursive: true });
  const latestPointerPath = path.join(bootstrapRoot, 'latest');
  writeLatestPointer(latestPointerPath, outDir);

  return {
    outDir,
    manifestPath,
    guidePath,
    latestPointerPath,
    manifest,
    ...(filtered.length < 5
      ? { warning: `Only ${filtered.length} sessions found; five or more are recommended.` }
      : {}),
  };
}

function writeLatestPointer(latestPointerPath: string, outDir: string): void {
  if (fs.existsSync(latestPointerPath)) {
    const stat = fs.lstatSync(latestPointerPath);
    if (!stat.isFile()) {
      fs.unlinkSync(latestPointerPath);
    }
  }
  fs.writeFileSync(latestPointerPath, `${outDir}\n`, 'utf8');
}

function resolveOutDir(outDir: string | undefined, bootstrapRoot: string, now: () => Date): string {
  if (outDir) {
    return path.resolve(outDir);
  }

  const timestamp = now().toISOString();
  let candidate = path.join(bootstrapRoot, timestamp);
  let suffix = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(bootstrapRoot, `${timestamp}-${suffix}`);
    suffix += 1;
  }
  return candidate;
}

function parseSince(since: string | undefined): number | undefined {
  if (!since) {
    return undefined;
  }

  const parsed = Date.parse(since);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid --since date: ${since}`);
  }
  return parsed;
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return Number.POSITIVE_INFINITY;
  }
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error(`Invalid limit: ${limit}`);
  }
  return limit;
}

function readJsonLines(filePath: string): unknown[] {
  try {
    return fs
      .readFileSync(filePath, 'utf8')
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return undefined;
        }
      });
  } catch {
    return [];
  }
}

function matchesFilters(
  digest: SessionDigest,
  mtimeMs: number,
  workspace: string | undefined,
  since: number | undefined,
): boolean {
  if (workspace) {
    if (digest.host === 'cursor') {
      const slug = encodeCursorProjectSlug(workspace);
      const matches =
        digest.workspaceRoot === workspace ||
        digest.workspaceLabel === slug ||
        digest.workspaceRoot === slug;
      if (!matches) {
        return false;
      }
    } else if (digest.workspaceRoot !== workspace) {
      return false;
    }
  }

  return (
    since === undefined ||
    mtimeMs >= since ||
    (!Number.isNaN(Date.parse(digest.startedAt)) && Date.parse(digest.startedAt) >= since)
  );
}

function uniqueDigestFilename(digest: SessionDigest, counts: Map<string, number>): string {
  const base = `${digest.host}__${sanitizeFilename(digest.workspaceLabel || path.basename(digest.workspaceRoot) || 'unknown')}__${sanitizeFilename(digest.sessionId)}`;
  const count = counts.get(base) ?? 0;
  counts.set(base, count + 1);
  return `${base}${count === 0 ? '' : `-${count + 1}`}.json`;
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
}

function buildWorkspaces(
  records: DigestRecord[],
  digestPaths: Map<SessionDigest, string>,
): BootstrapManifest['workspaces'] {
  const groups = new Map<string, { label: string; digestPaths: string[] }>();

  for (const { digest } of records) {
    const workspaceRoot = digest.workspaceRoot;
    const group = groups.get(workspaceRoot) ?? {
      label: digest.workspaceLabel || path.basename(workspaceRoot) || 'unknown',
      digestPaths: [],
    };
    group.digestPaths.push(digestPaths.get(digest)!);
    groups.set(workspaceRoot, group);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([workspaceRoot, group]) => ({
      workspaceRoot,
      label: group.label,
      sessionCount: group.digestPaths.length,
      digestPaths: group.digestPaths.sort((left, right) => left.localeCompare(right)),
    }));
}
