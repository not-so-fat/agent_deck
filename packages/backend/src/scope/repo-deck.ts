import fs from 'node:fs/promises';
import path from 'node:path';
import { RepoDeckManifest, RepoDeckManifestSchema, REPO_DECK_MANIFEST_PATH } from '@agent-deck/shared';

export class RepoDeckManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepoDeckManifestError';
  }
}

/** Lightweight parser — avoids a YAML dependency for the single-field MVP manifest. */
export function parseRepoDeckManifest(content: string): RepoDeckManifest {
  const deckIdMatch = content.match(/^deck_id:\s*["']?([0-9a-f-]{36})["']?\s*$/im);
  if (!deckIdMatch) {
    throw new RepoDeckManifestError('deck_id is required in .agent-deck/deck.yaml');
  }

  const nameMatch = content.match(/^name:\s*["']?(.+?)["']?\s*$/im);
  const raw = {
    deck_id: deckIdMatch[1],
    ...(nameMatch ? { name: nameMatch[1].trim() } : {}),
  };

  return RepoDeckManifestSchema.parse(raw);
}

export function repoDeckManifestFilePath(workspaceRoot: string): string {
  return path.join(path.resolve(workspaceRoot), REPO_DECK_MANIFEST_PATH);
}

export async function loadRepoDeckManifest(workspaceRoot: string): Promise<RepoDeckManifest | null> {
  const filePath = repoDeckManifestFilePath(workspaceRoot);

  try {
    const content = await fs.readFile(filePath, 'utf8');
    return parseRepoDeckManifest(content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    if (error instanceof RepoDeckManifestError) {
      throw error;
    }
    throw new RepoDeckManifestError(
      error instanceof Error ? error.message : 'Failed to read .agent-deck/deck.yaml',
    );
  }
}

export function formatRepoDeckManifest(deckId: string, name?: string): string {
  const lines = [
    '# Link this repo to an Agent Deck (copy to .agent-deck/deck.yaml in your project)',
    `deck_id: ${deckId}`,
  ];
  if (name) {
    lines.push(`name: ${name}`);
  }
  return lines.join('\n') + '\n';
}
