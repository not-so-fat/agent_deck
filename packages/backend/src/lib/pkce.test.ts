import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';

import { generatePkcePair } from './pkce';

describe('generatePkcePair', () => {
  it('produces S256 challenge from verifier', () => {
    const { codeVerifier, codeChallenge } = generatePkcePair();

    expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(codeChallenge).toBe(
      createHash('sha256').update(codeVerifier).digest('base64url'),
    );
  });

  it('generates unique pairs', () => {
    const first = generatePkcePair();
    const second = generatePkcePair();

    expect(first.codeVerifier).not.toBe(second.codeVerifier);
    expect(first.codeChallenge).not.toBe(second.codeChallenge);
  });
});
