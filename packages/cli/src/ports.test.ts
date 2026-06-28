import { describe, expect, it } from 'vitest';

import { compareSemver } from './upgrade';

describe('compareSemver', () => {
  it('detects newer patch versions', () => {
    expect(compareSemver('1.1.1', '1.1.0')).toBeGreaterThan(0);
    expect(compareSemver('1.1.0', '1.1.1')).toBeLessThan(0);
    expect(compareSemver('1.1.0', '1.1.0')).toBe(0);
  });
});
