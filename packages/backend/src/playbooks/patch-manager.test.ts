import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseManager } from '../models/database';
import { PlaybookManager } from './playbook-manager';
import { PatchManager, PatchConflictError, PatchNoChangeError } from './patch-manager';

describe('PatchManager', () => {
  let dbPath: string;
  let db: DatabaseManager;
  let playbookManager: PlaybookManager;
  let patchManager: PatchManager;
  let deckId: string;

  beforeEach(async () => {
    dbPath = path.join(os.tmpdir(), `agent-deck-patches-${Date.now()}.db`);
    db = new DatabaseManager(dbPath);
    playbookManager = new PlaybookManager(db);
    patchManager = new PatchManager(db, playbookManager);
    const deck = await db.createDeck({ name: `dev-${Date.now()}`, isActive: false });
    deckId = deck.id;
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dbPath, { force: true });
  });

  it('proposes, previews, accepts an update patch', async () => {
    const playbook = await playbookManager.create({
      title: 'Hiring inbox',
      body: '## Gotchas\n- Old gotcha.\n',
      triggers: ['check inbox'],
    });
    await playbookManager.addToDeck({ deckId, playbookId: playbook.id });

    const patch = await patchManager.propose(
      {
        kind: 'update',
        playbook_id: playbook.id,
        ops: [{ op: 'add_item', section: 'Gotchas', text: 'New gotcha.' }],
        rationale: 'User corrected output.',
        evidence: {
          failure_summary: 'Missed dry-run',
          user_feedback_excerpt: 'always dry-run first',
        },
      },
      'ide',
      'session-1',
    );

    const preview = await patchManager.preview(patch.id);
    expect(preview?.after.body).toContain('New gotcha.');

    const accepted = await patchManager.accept(patch.id);
    expect(accepted.status).toBe('accepted');

    const updated = await db.getPlaybook(playbook.id);
    expect(updated?.body).toContain('New gotcha.');

    const versions = await db.listPlaybookVersions(playbook.id);
    expect(versions).toHaveLength(1);
  });

  it('proposes and accepts genesis create patch', async () => {
    const patch = await patchManager.propose(
      {
        kind: 'create',
        new_playbook: {
          title: 'Slip risk',
          body: '## Gotchas\n- Check velocity vs capacity.\n',
          triggers: ['slip risk', 'sprint risk'],
          deck_id: deckId,
        },
        rationale: 'New task uncovered by correction.',
      },
      'ide',
      null,
    );

    const accepted = await patchManager.accept(patch.id);
    expect(accepted.status).toBe('accepted');

    const onDeck = await playbookManager.listForDeck(deckId);
    expect(onDeck).toHaveLength(1);
    expect(onDeck[0].triggers).toContain('slip risk');
  });

  it('rejects propose when anchor does not resolve', async () => {
    const playbook = await playbookManager.create({
      title: 'Test',
      body: '## Steps\n- Step one.\n',
      triggers: [],
    });

    await expect(
      patchManager.propose(
        {
          kind: 'update',
          playbook_id: playbook.id,
          ops: [
            {
              op: 'amend_item',
              section: 'Steps',
              anchor: '- Missing anchor.',
              text: '- Nope.',
            },
          ],
          rationale: 'test',
        },
        'ide',
        null,
      ),
    ).rejects.toBeInstanceOf(PatchConflictError);
  });

  it('rejects propose when ops produce no change', async () => {
    const playbook = await playbookManager.create({
      title: 'Test',
      body: '## Steps\n- Step one.\n',
      triggers: ['ship'],
    });

    await expect(
      patchManager.propose(
        {
          kind: 'update',
          playbook_id: playbook.id,
          ops: [{ op: 'set_triggers', triggers: ['ship'] }],
          rationale: 'test',
        },
        'ide',
        null,
      ),
    ).rejects.toBeInstanceOf(PatchNoChangeError);
  });

  it('marks patch stale on anchor conflict at accept', async () => {
    const playbook = await playbookManager.create({
      title: 'Test',
      body: '## Steps\n- Step one.\n',
      triggers: [],
    });

    // Bypass propose-time validation by inserting patch directly (simulates legacy proposals).
    const patch = await db.createPlaybookPatch({
      id: `pp_${Date.now()}`,
      kind: 'update',
      playbookId: playbook.id,
      opsJson: JSON.stringify([
        {
          op: 'amend_item',
          section: 'Steps',
          anchor: '- Missing anchor.',
          text: '- Nope.',
        },
      ]),
      rationale: 'test',
      source: 'ide',
      sourceRef: null,
      evidenceJson: null,
    });

    await expect(patchManager.accept(patch.id)).rejects.toBeInstanceOf(PatchConflictError);
    const stale = await db.getPlaybookPatch(patch.id);
    expect(stale?.status).toBe('stale');
  });

  it('rejects a proposed patch with reason', async () => {
    const playbook = await playbookManager.create({
      title: 'Test',
      body: 'Body',
      triggers: [],
    });
    const patch = await patchManager.propose(
      {
        kind: 'update',
        playbook_id: playbook.id,
        ops: [{ op: 'rewrite_body', text: 'Nope' }],
        rationale: 'test',
      },
      'ide',
      null,
    );

    const rejected = await patchManager.reject(patch.id, 'Too broad');
    expect(rejected?.status).toBe('rejected');
    expect(rejected?.rejectionReason).toBe('Too broad');
  });

  it('persists trigger conflicts on genesis propose and syncs stubs on accept', async () => {
    const existing = await playbookManager.create({
      title: 'Existing',
      body: '## Gotchas\n- one\n',
      triggers: ['master-detail layout', 'human gate UI'],
    });
    await playbookManager.addToDeck({ deckId, playbookId: existing.id });

    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-deck-patch-stub-'));
    await db.upsertDeckWorkspace(workspace, deckId);

    const patch = await patchManager.propose(
      {
        kind: 'create',
        new_playbook: {
          title: 'UI principle',
          body: '## Gotchas\n- split panes\n',
          triggers: ['master-detail layout', 'split-pane UI'],
          deck_id: deckId,
        },
        rationale: 'Genesis with overlapping triggers.',
      },
      'ide',
      null,
    );

    expect(patch.conflictsJson).toBeTruthy();
    const conflicts = JSON.parse(patch.conflictsJson!);
    expect(conflicts.length).toBeGreaterThan(0);

    await patchManager.accept(patch.id);

    const cursorStubDir = path.join(workspace, '.cursor', 'rules', 'agent-deck-stubs');
    expect(fs.existsSync(cursorStubDir)).toBe(true);
    fs.rmSync(workspace, { recursive: true, force: true });
  });
});
