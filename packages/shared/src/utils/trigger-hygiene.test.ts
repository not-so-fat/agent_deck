import { describe, expect, it } from 'vitest';
import {
  detectTriggerConflicts,
  normalizeTriggers,
  TriggerValidationError,
} from './trigger-hygiene';

const productPrinciple = {
  id: 'pb_product_principle',
  title: 'Product principle',
  triggers: [
    'master-detail layout',
    'split-pane UI',
    'human gate UI',
    'review product layout',
    'drafting design doc',
  ],
};

const uiPrinciple = {
  id: 'pb_ui_principle',
  title: 'UI principle',
  triggers: [
    'master-detail layout',
    'split-pane UI layout',
    'human gate UI',
    'review UI layout',
    'split-pane UI',
  ],
};

describe('normalizeTriggers', () => {
  it('trims, collapses whitespace, and dedupes case-insensitively', () => {
    expect(normalizeTriggers([' PRD ', 'prd', '  write   PRD  '])).toEqual(['PRD', 'write PRD']);
  });

  it('rejects triggers longer than 80 characters', () => {
    expect(() => normalizeTriggers(['x'.repeat(81)])).toThrow(TriggerValidationError);
  });

  it('rejects more than 16 triggers', () => {
    const many = Array.from({ length: 17 }, (_, index) => `trigger ${index}`);
    expect(() => normalizeTriggers(many)).toThrow(TriggerValidationError);
  });
});

describe('detectTriggerConflicts', () => {
  it('detects exact, subsumes, and overlap for the live product/ui pair', () => {
    const conflicts = detectTriggerConflicts(uiPrinciple, [productPrinciple, uiPrinciple]);

    expect(conflicts.some((conflict) => conflict.level === 'exact')).toBe(true);
    expect(
      conflicts.some(
        (conflict) => conflict.level === 'subsumes' || conflict.level === 'overlap',
      ),
    ).toBe(true);
    expect(conflicts.length).toBeGreaterThanOrEqual(2);
  });
});
