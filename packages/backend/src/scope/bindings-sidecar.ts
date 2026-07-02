import fs from 'node:fs/promises';
import path from 'node:path';
import {
  BindingEntry,
  BindingsFile,
  BindingsFileSchema,
  listBindingsFileCandidates,
  lookupWorkspaceBinding,
  normalizeWorkspaceRoot,
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

export async function readBindingForSession(sessionId: string): Promise<BindingEntry | null> {
  const bindings = await readBindingsFile();
  return bindings[sessionId.trim()] ?? null;
}

export async function upsertBindingForSession(
  sessionId: string,
  entry: BindingEntry,
): Promise<void> {
  const bindings = await readBindingsFile();
  bindings[sessionId.trim()] = entry;
  await writeBindingsFile(bindings);
}

/** @deprecated Legacy workspace-keyed sidecar; status display is session-scoped. */
export async function readBindingForWorkspace(workspaceRoot: string): Promise<BindingEntry | null> {
  const bindings = await readBindingsFile();
  return lookupWorkspaceBinding(bindings, workspaceRoot);
}

/** @deprecated Legacy workspace-keyed sidecar; use upsertBindingForSession. */
export async function upsertBindingForWorkspace(
  workspaceRoot: string,
  entry: BindingEntry,
): Promise<void> {
  const bindings = await readBindingsFile();
  bindings[normalizeWorkspaceRoot(workspaceRoot)] = entry;
  await writeBindingsFile(bindings);
}
