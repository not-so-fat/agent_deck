import fs from 'node:fs/promises';
import path from 'node:path';
import {
  BindingEntry,
  BindingsFile,
  BindingsFileSchema,
  isBindingSidecarSessionKey,
  listBindingsFileCandidates,
  lookupWorkspaceBinding,
  normalizeWorkspaceRoot,
  resolveBindingEntry,
  resolveBindingsFilePath,
} from '@agent-deck/shared';

async function readBindingsFile(): Promise<BindingsFile> {
  const merged: BindingsFile = {};

  for (const filePath of listBindingsFileCandidates()) {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = BindingsFileSchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        Object.assign(merged, parsed.data);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return merged;
}

async function writeBindingsFile(bindings: BindingsFile): Promise<void> {
  const filePath = resolveBindingsFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(bindings, null, 2)}\n`, 'utf8');
}

function pruneLegacySessionKeys(bindings: BindingsFile): void {
  for (const key of Object.keys(bindings)) {
    if (isBindingSidecarSessionKey(key)) {
      delete bindings[key];
    }
  }
}

/** Write workspace-keyed binding for terminal status line; prune orphaned MCP session UUID keys. */
export async function upsertWorkspaceDisplayBinding(
  workspaceRoot: string,
  entry: BindingEntry,
): Promise<void> {
  const bindings = await readBindingsFile();
  bindings[normalizeWorkspaceRoot(workspaceRoot)] = entry;
  pruneLegacySessionKeys(bindings);
  await writeBindingsFile(bindings);
}

export async function readBindingForDisplay(options: {
  sessionId?: string;
  workspaceRoot: string;
}): Promise<BindingEntry | null> {
  const bindings = await readBindingsFile();
  return resolveBindingEntry(bindings, options);
}

export async function readBindingForWorkspace(workspaceRoot: string): Promise<BindingEntry | null> {
  const bindings = await readBindingsFile();
  return lookupWorkspaceBinding(bindings, workspaceRoot);
}
