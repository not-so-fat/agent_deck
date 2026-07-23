import fs from 'node:fs';
import path from 'node:path';

export type EnumeratedSession = {
  sessionId: string;
  filePath: string;
  mtimeMs: number;
};

export function enumerateSessions(projectsDir: string): EnumeratedSession[] {
  let workspaceEntries: fs.Dirent[];

  try {
    workspaceEntries = fs.readdirSync(projectsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const sessions: EnumeratedSession[] = [];
  for (const workspaceEntry of workspaceEntries.filter((entry) => entry.isDirectory()).sort(byName)) {
    const workspaceDir = path.join(projectsDir, workspaceEntry.name);
    let sessionEntries: fs.Dirent[];

    try {
      sessionEntries = fs.readdirSync(workspaceDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const sessionEntry of sessionEntries.filter(isJsonlFile).sort(byName)) {
      const filePath = path.join(workspaceDir, sessionEntry.name);
      try {
        sessions.push({
          sessionId: path.basename(sessionEntry.name, '.jsonl'),
          filePath,
          mtimeMs: fs.statSync(filePath).mtimeMs,
        });
      } catch {
        // A session may disappear while history is being enumerated.
      }
    }
  }

  return sessions;
}

function byName(left: fs.Dirent, right: fs.Dirent): number {
  return left.name.localeCompare(right.name);
}

function isJsonlFile(entry: fs.Dirent): boolean {
  return entry.isFile() && entry.name.endsWith('.jsonl');
}
