import fs from 'node:fs';
import path from 'node:path';

import { REPO_DECK_MANIFEST_PATH } from '@agent-deck/shared';
import { CLI_DEFAULT_BACKEND_PORT, parseCliBackendPort } from './defaults';

type DeckSummary = { id: string; name: string };

function manifestPath(workspaceRoot: string): string {
  return path.join(path.resolve(workspaceRoot), REPO_DECK_MANIFEST_PATH);
}

function readDeckIdFromManifest(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/^deck_id:\s*["']?([0-9a-f-]{36})["']?\s*$/im);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function writeManifest(workspaceRoot: string, deckId: string, deckName?: string): string {
  const filePath = manifestPath(workspaceRoot);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const lines = [
    '# Linked by agent-deck setup --scope project (edit deck_id from dashboard if needed)',
    `deck_id: ${deckId}`,
  ];
  if (deckName?.trim()) {
    lines.push(`name: ${deckName.trim()}`);
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
  return filePath;
}

async function fetchDecks(backendUrl: string): Promise<DeckSummary[]> {
  const response = await fetch(`${backendUrl}/api/decks`, {
    signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) {
    throw new Error(`GET /api/decks returned ${response.status}`);
  }
  const body = (await response.json()) as { success?: boolean; data?: DeckSummary[] };
  return body.success && Array.isArray(body.data) ? body.data : [];
}

async function resolveDeck(
  backendUrl: string,
  deckId: string,
): Promise<{ ok: boolean; deckName?: string; error?: string }> {
  const response = await fetch(`${backendUrl}/api/decks/${deckId}`, {
    signal: AbortSignal.timeout(2500),
  });
  if (response.status === 404) {
    return { ok: false, error: 'Deck not found' };
  }
  if (!response.ok) {
    return { ok: false, error: `GET /api/decks/${deckId} returned ${response.status}` };
  }
  const body = (await response.json()) as { success?: boolean; data?: { name?: string } };
  return body.success ? { ok: true, deckName: body.data?.name } : { ok: false, error: 'Invalid deck response' };
}

function pickDeck(decks: DeckSummary[], preferredName = 'dev'): DeckSummary | null {
  if (decks.length === 0) {
    return null;
  }
  const byName = decks.find((deck) => deck.name === preferredName);
  return byName ?? decks[0];
}

export type RepoDeckInitResult = {
  action: 'created' | 'updated' | 'valid' | 'skipped';
  path?: string;
  message: string;
};

export async function ensureRepoDeckManifest(
  workspaceRoot: string,
  options?: { host?: string; backendPort?: number; preferredDeckName?: string },
): Promise<RepoDeckInitResult> {
  const host = options?.host ?? process.env.AGENT_DECK_HOST ?? '127.0.0.1';
  const backendPort =
    options?.backendPort ??
    (process.env.AGENT_DECK_PORT?.trim()
      ? parseCliBackendPort(process.env.AGENT_DECK_PORT)
      : CLI_DEFAULT_BACKEND_PORT);
  const backendUrl = `http://${host}:${backendPort}`;
  const filePath = manifestPath(workspaceRoot);
  const existingDeckId = readDeckIdFromManifest(filePath);

  let decks: DeckSummary[];
  try {
    decks = await fetchDecks(backendUrl);
  } catch {
    if (existingDeckId) {
      return {
        action: 'skipped',
        path: filePath,
        message: `${REPO_DECK_MANIFEST_PATH} exists but Agent Deck API is offline — start backend to validate deck_id`,
      };
    }
    return {
      action: 'skipped',
      message: `No ${REPO_DECK_MANIFEST_PATH} — start Agent Deck, then re-run setup --scope project or ask MCP setup_repo_deck`,
    };
  }

  if (existingDeckId) {
    const resolved = await resolveDeck(backendUrl, existingDeckId);
    if (resolved.ok) {
      return {
        action: 'valid',
        path: filePath,
        message: `Repo deck manifest OK → ${filePath} (${resolved.deckName ?? existingDeckId})`,
      };
    }
  }

  const deck = pickDeck(decks, options?.preferredDeckName ?? 'dev');
  if (!deck) {
    return {
      action: 'skipped',
      message: 'No decks in Agent Deck — create one in the dashboard, then re-run setup --scope project',
    };
  }

  const action = existingDeckId ? 'updated' : 'created';
  const written = writeManifest(workspaceRoot, deck.id, deck.name);
  const reason = existingDeckId ? `replaced invalid deck_id ${existingDeckId}` : 'linked workspace to dashboard deck';
  return {
    action,
    path: written,
    message: `${action === 'created' ? 'Wrote' : 'Updated'} ${REPO_DECK_MANIFEST_PATH} → ${written} (${reason}: ${deck.name})`,
  };
}
