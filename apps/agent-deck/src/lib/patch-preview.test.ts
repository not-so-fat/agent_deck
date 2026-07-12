import { describe, expect, it } from 'vitest';
import { patchPreviewHasChanges } from './patch-preview';

describe('patchPreviewHasChanges', () => {
  const base = {
    before: { title: 'T', body: '## Steps\n- One\n', triggers: ['a'] },
    after: { title: 'T', body: '## Steps\n- One\n', triggers: ['a'] },
  };

  it('returns false when before and after are identical', () => {
    expect(patchPreviewHasChanges(base)).toBe(false);
  });

  it('detects body changes', () => {
    expect(
      patchPreviewHasChanges({
        ...base,
        after: { ...base.after, body: '## Steps\n- Two\n' },
      }),
    ).toBe(true);
  });

  it('detects trigger changes', () => {
    expect(
      patchPreviewHasChanges({
        ...base,
        after: { ...base.after, triggers: ['a', 'b'] },
      }),
    ).toBe(true);
  });

  it('detects title changes', () => {
    expect(
      patchPreviewHasChanges({
        ...base,
        after: { ...base.after, title: 'New title' },
      }),
    ).toBe(true);
  });
});
