import { describe, it, expect } from 'vitest';
import { applyPatchOps } from './apply-patch-ops';
import type { PatchOp } from '@agent-deck/shared';

const SAMPLE_BODY = `# Hiring inbox

## Steps
- Run the hiring CLI via Agent Deck exec.
- Walk results worst-tier first.

## Gotchas
- Do not skip dry-run until user says otherwise.
`;

describe('applyPatchOps', () => {
  it('add_item appends to an existing section', () => {
    const ops: PatchOp[] = [
      {
        op: 'add_item',
        section: 'Gotchas',
        text: 'Slack chat.postMessage silently truncates blocks > 50.',
      },
    ];
    const result = applyPatchOps({ body: SAMPLE_BODY, triggers: ['check inbox'] }, ops);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.body).toContain('Slack chat.postMessage silently truncates blocks > 50.');
    expect(result.value.triggers).toEqual(['check inbox']);
  });

  it('add_item creates a missing section at the end', () => {
    const ops: PatchOp[] = [
      { op: 'add_item', section: 'Checklist', text: 'Verify dry-run output before writes.' },
    ];
    const result = applyPatchOps({ body: '# Title\n\n## Steps\n- One step\n', triggers: [] }, ops);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.body).toContain('## Checklist');
    expect(result.value.body).toContain('- Verify dry-run output before writes.');
  });

  it('amend_item replaces an anchored line', () => {
    const ops: PatchOp[] = [
      {
        op: 'amend_item',
        section: 'Steps',
        anchor: '- Run the hiring CLI via Agent Deck exec.',
        text: '- Run the hiring CLI via Agent Deck exec with --dry-run.',
      },
    ];
    const result = applyPatchOps({ body: SAMPLE_BODY, triggers: [] }, ops);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.body).toContain('- Run the hiring CLI via Agent Deck exec with --dry-run.');
    expect(result.value.body).not.toContain('- Run the hiring CLI via Agent Deck exec.\n');
  });

  it('remove_item deletes an anchored line', () => {
    const ops: PatchOp[] = [
      {
        op: 'remove_item',
        section: 'Gotchas',
        anchor: '- Do not skip dry-run until user says otherwise.',
      },
    ];
    const result = applyPatchOps({ body: SAMPLE_BODY, triggers: [] }, ops);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.body).not.toContain('Do not skip dry-run');
  });

  it('set_triggers updates metadata triggers', () => {
    const ops: PatchOp[] = [
      { op: 'set_triggers', triggers: ['check inbox', 'review applicants'] },
    ];
    const result = applyPatchOps({ body: SAMPLE_BODY, triggers: ['old'] }, ops);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.triggers).toEqual(['check inbox', 'review applicants']);
    expect(result.value.body).toBe(SAMPLE_BODY);
  });

  it('rewrite_body replaces the entire body', () => {
    const ops: PatchOp[] = [{ op: 'rewrite_body', text: '# New\n\nOne gotcha only.' }];
    const result = applyPatchOps({ body: SAMPLE_BODY, triggers: ['x'] }, ops);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.body).toBe('# New\n\nOne gotcha only.');
  });

  it('rejects amend_item on prose lines', () => {
    const body = `## After merge

The Chronicle UI git pill reflects the live checkout branch.
`;
    const ops: PatchOp[] = [
      {
        op: 'amend_item',
        section: 'After merge',
        anchor: 'The Chronicle UI git pill reflects the live checkout branch.',
        text: 'Any UI/status indicator that reflects the live checkout branch.',
      },
    ];
    const result = applyPatchOps({ body, triggers: [] }, ops);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.conflict).toMatch(/list item line/i);
  });

  it('returns conflict when anchor is missing (all-or-nothing)', () => {
    const ops: PatchOp[] = [
      { op: 'add_item', section: 'Gotchas', text: 'New gotcha.' },
      {
        op: 'amend_item',
        section: 'Steps',
        anchor: '- This line does not exist.',
        text: '- Replacement.',
      },
    ];
    const result = applyPatchOps({ body: SAMPLE_BODY, triggers: [] }, ops);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.conflict).toMatch(/anchor/i);
  });

  it('preserves unicode and exact whitespace in anchors', () => {
    const body = '## Gotchas\n- Café résumé — keep accents.\n';
    const ops: PatchOp[] = [
      {
        op: 'amend_item',
        section: 'Gotchas',
        anchor: '- Café résumé — keep accents.',
        text: '- Café résumé — keep accents and diacritics.',
      },
    ];
    const result = applyPatchOps({ body, triggers: [] }, ops);
    expect(result.ok).toBe(true);
  });

  it('applies multiple valid ops in order', () => {
    const ops: PatchOp[] = [
      { op: 'add_item', section: 'Gotchas', text: '- Added gotcha.' },
      { op: 'set_triggers', triggers: ['ship', 'release'] },
    ];
    const result = applyPatchOps({ body: SAMPLE_BODY, triggers: [] }, ops);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.body).toContain('- Added gotcha.');
    expect(result.value.triggers).toEqual(['ship', 'release']);
  });
});
