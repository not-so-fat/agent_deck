import fs from 'node:fs';
import type { PlaybookSummary, TriggerConflict } from '@agent-deck/shared';
import { detectTriggerConflicts } from '@agent-deck/shared';
import type { DatabaseManager } from '../models/database';
import type { PlaybookManager } from './playbook-manager';
import {
  isStubSyncEnabled,
  syncPlaybookStubs,
  type StubSyncResult,
} from './stub-sync';

export async function triggerWarningsForDeck(
  playbookManager: PlaybookManager,
  deckId: string,
  candidate: PlaybookSummary,
): Promise<TriggerConflict[]> {
  const summaries = await playbookManager.listSummariesForDeck(deckId);
  return detectTriggerConflicts(candidate, summaries);
}

export async function triggerWarningsForPlaybookDecks(
  db: DatabaseManager,
  playbookManager: PlaybookManager,
  candidate: PlaybookSummary,
  extraDeckIds: string[] = [],
): Promise<TriggerConflict[]> {
  const deckIds = new Set(extraDeckIds);
  if (candidate.id && candidate.id !== '__new__') {
    for (const deckId of await db.listDeckIdsForPlaybook(candidate.id)) {
      deckIds.add(deckId);
    }
  }

  const conflicts: TriggerConflict[] = [];
  const seen = new Set<string>();
  for (const deckId of deckIds) {
    for (const conflict of await triggerWarningsForDeck(playbookManager, deckId, candidate)) {
      const key = `${conflict.trigger}\0${conflict.otherPlaybookId}\0${conflict.level}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      conflicts.push(conflict);
    }
  }
  return conflicts;
}

export function parseTriggerConflicts(json: string | null): TriggerConflict[] {
  if (!json) {
    return [];
  }
  try {
    return JSON.parse(json) as TriggerConflict[];
  } catch {
    return [];
  }
}

export type DeckStubSyncReport = {
  workspaceRoot: string;
  stubs: StubSyncResult | null;
  pruned: boolean;
};

export async function syncStubsForDeck(
  db: DatabaseManager,
  playbookManager: PlaybookManager,
  deckId: string,
): Promise<DeckStubSyncReport[]> {
  if (!isStubSyncEnabled()) {
    return [];
  }

  const summaries = await playbookManager.listSummariesForDeck(deckId);
  const workspaces = await db.listDeckWorkspaces(deckId);
  const reports: DeckStubSyncReport[] = [];

  for (const workspace of workspaces) {
    if (!fs.existsSync(workspace.workspaceRoot)) {
      await db.removeDeckWorkspace(workspace.workspaceRoot, deckId);
      reports.push({ workspaceRoot: workspace.workspaceRoot, stubs: null, pruned: true });
      continue;
    }

    const stubs = syncPlaybookStubs(workspace.workspaceRoot, summaries);
    reports.push({ workspaceRoot: workspace.workspaceRoot, stubs, pruned: false });
  }

  return reports;
}

export function patchTouchesStubSurface(patch: {
  kind: string;
  opsJson: string;
}): boolean {
  if (patch.kind === 'create' || patch.kind === 'retire') {
    return true;
  }
  try {
    const ops = JSON.parse(patch.opsJson) as Array<{ op?: string }>;
    return ops.some((op) => op.op === 'set_triggers');
  } catch {
    return false;
  }
}
