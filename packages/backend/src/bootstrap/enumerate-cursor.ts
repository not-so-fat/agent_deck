import fs from 'node:fs';
import path from 'node:path';
import type { EnumeratedSession } from './enumerate';

export type EnumeratedCursorSession = EnumeratedSession & {
  projectSlug: string;
};

/**
 * Walk `~/.cursor/projects/<slug>/agent-transcripts/` for parent session JSONL.
 * Supports `<sessionId>/<sessionId>.jsonl` and legacy flat `*.jsonl`.
 * Excludes nested subagents directories.
 */
export function enumerateCursorSessions(projectsDir: string): EnumeratedCursorSession[] {
  let projectEntries: fs.Dirent[];
  try {
    projectEntries = fs.readdirSync(projectsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const sessions: EnumeratedCursorSession[] = [];
  for (const projectEntry of projectEntries.filter((entry) => entry.isDirectory()).sort(byName)) {
    if (isJunkCursorProjectSlug(projectEntry.name)) {
      continue;
    }
    const transcriptsRoot = path.join(projectsDir, projectEntry.name, 'agent-transcripts');
    if (!fs.existsSync(transcriptsRoot) || !fs.statSync(transcriptsRoot).isDirectory()) {
      continue;
    }
    collectCursorTranscripts(transcriptsRoot, projectEntry.name, sessions);
  }

  return sessions;
}

/** Skip Cursor project dirs that are not real workspace path encodings. */
export function isJunkCursorProjectSlug(slug: string): boolean {
  const trimmed = slug.trim();
  if (!trimmed || trimmed !== slug) {
    return true;
  }
  if (trimmed === 'empty-window') {
    return true;
  }
  // Cursor sometimes uses pure numeric ids for non-folder projects.
  if (/^\d+$/.test(trimmed)) {
    return true;
  }
  return false;
}

function collectCursorTranscripts(
  transcriptsRoot: string,
  projectSlug: string,
  sessions: EnumeratedCursorSession[],
): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(transcriptsRoot, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries.sort(byName)) {
    if (entry.name === 'subagents') {
      continue;
    }

    const fullPath = path.join(transcriptsRoot, entry.name);
    if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      pushSession(sessions, projectSlug, path.basename(entry.name, '.jsonl'), fullPath);
      continue;
    }

    if (!entry.isDirectory()) {
      continue;
    }

    // Nested session dir: <sessionId>/<sessionId>.jsonl (ignore subagents/)
    let nested: fs.Dirent[];
    try {
      nested = fs.readdirSync(fullPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const nestedEntry of nested.sort(byName)) {
      if (nestedEntry.name === 'subagents' || !nestedEntry.isFile() || !nestedEntry.name.endsWith('.jsonl')) {
        continue;
      }
      const sessionId = path.basename(nestedEntry.name, '.jsonl');
      // Prefer the canonical <sessionId>/<sessionId>.jsonl; still accept other jsonl in the session folder.
      pushSession(sessions, projectSlug, sessionId, path.join(fullPath, nestedEntry.name));
    }
  }
}

function pushSession(
  sessions: EnumeratedCursorSession[],
  projectSlug: string,
  sessionId: string,
  filePath: string,
): void {
  try {
    sessions.push({
      sessionId,
      filePath,
      mtimeMs: fs.statSync(filePath).mtimeMs,
      projectSlug,
    });
  } catch {
    // Session may disappear while history is being enumerated.
  }
}

function byName(left: fs.Dirent, right: fs.Dirent): number {
  return left.name.localeCompare(right.name);
}
