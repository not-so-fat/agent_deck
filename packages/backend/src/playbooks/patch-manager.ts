import {
  CreatePlaybookPatchFieldsSchema,
  PatchOpSchema,
  ProposePlaybookPatchInput,
  ProposePlaybookPatchSchema,
  type PatchOp,
  type PatchPreview,
  type PlaybookPatch,
  type PlaybookPatchListItem,
  type PlaybookPatchSource,
  generateShortId,
  derivePlaybookDefaults,
  generateId,
} from '@agent-deck/shared';
import { DatabaseManager } from '../models/database';
import { PlaybookManager } from './playbook-manager';
import { applyPatchOps } from './apply-patch-ops';
import {
  parseTriggerConflicts,
  patchTouchesStubSurface,
  syncStubsForDeck,
  triggerWarningsForPlaybookDecks,
} from './stub-workspace-sync';

export class PatchConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PatchConflictError';
  }
}

export class PatchNoChangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PatchNoChangeError';
  }
}

export class PatchManager {
  constructor(
    private db: DatabaseManager,
    private playbookManager: PlaybookManager,
  ) {}

  private newPatchId(): string {
    return `pp_${generateShortId()}`;
  }

  async propose(
    input: ProposePlaybookPatchInput,
    source: PlaybookPatchSource,
    sourceRef: string | null,
    deckIdForCreate?: string,
  ): Promise<PlaybookPatch> {
    const validated = ProposePlaybookPatchSchema.parse(input);

    if (validated.kind === 'create') {
      const fieldsInput = validated.new_playbook;
      if (!fieldsInput) {
        throw new Error('new_playbook is required for create patches');
      }
      const fields = CreatePlaybookPatchFieldsSchema.parse({
        ...fieldsInput,
        deck_id: fieldsInput.deck_id ?? deckIdForCreate,
      });
      if (!fields.deck_id) {
        throw new Error('deck_id is required for create patches');
      }
      const conflicts = await triggerWarningsForPlaybookDecks(
        this.db,
        this.playbookManager,
        {
          id: '__new__',
          title: fields.title,
          triggers: fields.triggers,
        },
        [fields.deck_id],
      );
      return this.db.createPlaybookPatch({
        id: this.newPatchId(),
        kind: 'create',
        playbookId: null,
        opsJson: JSON.stringify(fields),
        rationale: validated.rationale,
        source,
        sourceRef,
        evidenceJson: validated.evidence ? JSON.stringify(validated.evidence) : null,
        conflictsJson: conflicts.length > 0 ? JSON.stringify(conflicts) : null,
      });
    }

    if (!validated.playbook_id) {
      throw new Error('playbook_id is required for update patches');
    }
    const playbook = await this.db.getPlaybook(validated.playbook_id);
    if (!playbook) {
      throw new Error(`Playbook not found: ${validated.playbook_id}`);
    }

    const ops = parseOps(validated.ops ?? []);
    if (ops.length === 0) {
      throw new Error('ops is required and must not be empty for update patches');
    }

    const dryRun = applyPatchOps(
      { body: playbook.body, triggers: playbook.triggers },
      ops,
    );
    if (!dryRun.ok) {
      throw new PatchConflictError(dryRun.conflict);
    }
    const bodyUnchanged = dryRun.value.body === playbook.body;
    const triggersUnchanged =
      JSON.stringify(dryRun.value.triggers) === JSON.stringify(playbook.triggers);
    if (bodyUnchanged && triggersUnchanged) {
      throw new PatchNoChangeError(
        'Patch ops resolve but produce no change. amend_item/remove_item anchors must match exact list lines; use rewrite_body for prose edits.',
      );
    }

    const conflicts = await triggerWarningsForPlaybookDecks(this.db, this.playbookManager, {
      id: playbook.id,
      title: playbook.title,
      triggers: dryRun.value.triggers,
    });

    return this.db.createPlaybookPatch({
      id: this.newPatchId(),
      kind: validated.kind,
      playbookId: validated.playbook_id,
      opsJson: JSON.stringify(ops),
      rationale: validated.rationale,
      source,
      sourceRef,
      evidenceJson: validated.evidence ? JSON.stringify(validated.evidence) : null,
      conflictsJson: conflicts.length > 0 ? JSON.stringify(conflicts) : null,
    });
  }

  async preview(patchId: string): Promise<PatchPreview | null> {
    const patch = await this.db.getPlaybookPatch(patchId);
    if (!patch) return null;

    if (patch.kind === 'create') {
      const fields = CreatePlaybookPatchFieldsSchema.parse(JSON.parse(patch.opsJson));
      const triggerConflicts = await triggerWarningsForPlaybookDecks(
        this.db,
        this.playbookManager,
        {
          id: '__new__',
          title: fields.title,
          triggers: fields.triggers,
        },
        [fields.deck_id],
      );
      return {
        before: { title: '', body: '', triggers: [] },
        after: {
          title: fields.title,
          body: fields.body,
          triggers: fields.triggers,
        },
        trigger_conflicts: triggerConflicts,
      };
    }

    if (!patch.playbookId) return null;
    const playbook = await this.db.getPlaybook(patch.playbookId);
    if (!playbook) return null;

    const ops = parseOps(JSON.parse(patch.opsJson));
    const result = applyPatchOps(
      { body: playbook.body, triggers: playbook.triggers },
      ops,
    );
    if (!result.ok) {
      throw new PatchConflictError(result.conflict);
    }

    const triggerConflicts = await triggerWarningsForPlaybookDecks(this.db, this.playbookManager, {
      id: playbook.id,
      title: playbook.title,
      triggers: result.value.triggers,
    });

    return {
      before: {
        title: playbook.title,
        body: playbook.body,
        triggers: playbook.triggers,
      },
      after: {
        title: playbook.title,
        body: result.value.body,
        triggers: result.value.triggers,
      },
      trigger_conflicts: triggerConflicts,
    };
  }

  private async syncStubSurfaceForPatch(patch: PlaybookPatch): Promise<void> {
    if (!patchTouchesStubSurface(patch)) {
      return;
    }

    const deckIds = new Set<string>();
    if (patch.kind === 'create') {
      const fields = CreatePlaybookPatchFieldsSchema.parse(JSON.parse(patch.opsJson));
      deckIds.add(fields.deck_id);
    } else if (patch.playbookId) {
      for (const deckId of await this.db.listDeckIdsForPlaybook(patch.playbookId)) {
        deckIds.add(deckId);
      }
    }

    for (const deckId of deckIds) {
      await syncStubsForDeck(this.db, this.playbookManager, deckId);
    }
  }

  async accept(patchId: string): Promise<PlaybookPatch> {
    const patch = await this.db.getPlaybookPatch(patchId);
    if (!patch) {
      throw new Error('Patch not found');
    }
    if (patch.status !== 'proposed') {
      throw new Error(`Patch is not proposed (status=${patch.status})`);
    }

    if (patch.kind === 'create') {
      const fields = CreatePlaybookPatchFieldsSchema.parse(JSON.parse(patch.opsJson));
      const defaults = derivePlaybookDefaults(fields.title);
      const created = await this.playbookManager.create({
        title: fields.title,
        body: fields.body,
        triggers: fields.triggers,
        exec: fields.exec,
        skill: fields.skill,
        id: defaults.id,
        dependsOnCredentialIds: [],
        dependsOnServiceIds: [],
      });
      await this.playbookManager.addToDeck({ deckId: fields.deck_id, playbookId: created.id });
      await this.snapshotVersion(created, patchId, 'agent');
      const updated = await this.db.updatePlaybookPatchStatus(patchId, 'accepted');
      await this.syncStubSurfaceForPatch(patch);
      return updated!;
    }

    if (!patch.playbookId) {
      throw new Error('Update patch missing playbook_id');
    }
    const playbook = await this.db.getPlaybook(patch.playbookId);
    if (!playbook) {
      await this.db.updatePlaybookPatchStatus(
        patchId,
        'rejected',
        'Target playbook was deleted',
      );
      throw new Error('Target playbook was deleted');
    }

    const ops = parseOps(JSON.parse(patch.opsJson));
    const result = applyPatchOps(
      { body: playbook.body, triggers: playbook.triggers },
      ops,
    );
    if (!result.ok) {
      await this.db.updatePlaybookPatchStatus(patchId, 'stale');
      throw new PatchConflictError(result.conflict);
    }

    const updatedPlaybook = await this.playbookManager.updateWithDependencies(patch.playbookId, {
      body: result.value.body,
      triggers: result.value.triggers,
      autoDetectDependencies: true,
    });
    if (!updatedPlaybook) {
      throw new Error('Failed to update playbook');
    }
    await this.snapshotVersion(updatedPlaybook, patchId, 'agent');
    const accepted = await this.db.updatePlaybookPatchStatus(patchId, 'accepted');
    await this.syncStubSurfaceForPatch(patch);
    return accepted!;
  }

  async reject(patchId: string, reason: string): Promise<PlaybookPatch | null> {
    const patch = await this.db.getPlaybookPatch(patchId);
    if (!patch) return null;
    if (patch.status !== 'proposed') {
      throw new Error(`Patch is not proposed (status=${patch.status})`);
    }
    return this.db.updatePlaybookPatchStatus(patchId, 'rejected', reason);
  }

  async list(status?: PlaybookPatch['status']): Promise<PlaybookPatch[]> {
    return this.db.listPlaybookPatches(status);
  }

  async listForReview(status?: PlaybookPatch['status']): Promise<PlaybookPatchListItem[]> {
    const patches = await this.db.listPlaybookPatches(status);
    return Promise.all(patches.map((patch) => this.enrichListItem(patch)));
  }

  parseStoredTriggerConflicts(patch: PlaybookPatch) {
    return parseTriggerConflicts(patch.conflictsJson);
  }

  private async enrichListItem(patch: PlaybookPatch): Promise<PlaybookPatchListItem> {
    if (patch.kind === 'create') {
      const fields = CreatePlaybookPatchFieldsSchema.parse(JSON.parse(patch.opsJson));
      const deck = await this.db.getDeck(fields.deck_id);
      return {
        ...patch,
        displayTitle: fields.title,
        deckNames: deck ? [deck.name] : [],
      };
    }

    const playbook = patch.playbookId ? await this.db.getPlaybook(patch.playbookId) : null;
    const deckNames = patch.playbookId
      ? await this.db.listDeckNamesForPlaybook(patch.playbookId)
      : [];

    return {
      ...patch,
      displayTitle: playbook?.title ?? patch.playbookId ?? 'Unknown playbook',
      deckNames,
    };
  }

  async snapshotVersion(
    playbook: { id: string; title: string; body: string; triggers: string[] },
    patchId: string | null,
    actor: 'user' | 'agent',
  ): Promise<void> {
    await this.db.createPlaybookVersion({
      id: generateId(),
      playbookId: playbook.id,
      title: playbook.title,
      body: playbook.body,
      triggers: playbook.triggers,
      patchId,
      actor,
    });
  }
}

function parseOps(raw: unknown): PatchOp[] {
  if (!Array.isArray(raw)) {
    throw new Error('ops must be an array');
  }
  return raw.map((op) => PatchOpSchema.parse(op));
}
