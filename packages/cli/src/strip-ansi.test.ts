import { describe, expect, it } from 'vitest';
import { sanitizeJsonText, stripAnsi } from './strip-ansi';

describe('stripAnsi', () => {
  it('removes SGR color codes', () => {
    expect(stripAnsi('\u001b[33mnpm warn\u001b[0m hello')).toBe('npm warn hello');
  });

  it('sanitizes control characters from json text', () => {
    expect(sanitizeJsonText('{\n  "a": 1\u0007\n}')).toBe('{\n  "a": 1\n}');
  });
});
