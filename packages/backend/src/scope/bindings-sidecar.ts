import fs from 'node:fs/promises';
import path from 'node:path';
import {
  BindingEntry,
  BindingsFile,
  BindingsFileSchema,
  resolveBindingsFilePath,
} from '@agent-deck/shared';

async function readBindingsFile(): Promise<BindingsFile> {
  const filePath = resolveBindingsFilePath();
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = BindingsFileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

async function writeBindingsFile(bindings: BindingsFile): Promise<void> {
  const filePath = resolveBindingsFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(bindings, null, 2)}\n`, 'utf8');
}

export async function readBindingForWorkspace(workspaceRoot: string): Promise<BindingEntry | null> {
  const bindings = await readBindingsFile();
  return bindings[workspaceRoot] ?? null;
}

export async function upsertBindingForWorkspace(
  workspaceRoot: string,
  entry: BindingEntry,
): Promise<void> {
  const bindings = await readBindingsFile();
  bindings[workspaceRoot] = entry;
  await writeBindingsFile(bindings);
}
