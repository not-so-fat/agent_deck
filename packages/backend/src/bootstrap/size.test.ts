import { describe, expect, it } from 'vitest';
import { SessionDigestSchema } from '@agent-deck/shared';
import { digestSession } from './digest-session';

describe('digest size budget (NFR-2)', () => {
  it('keeps digest ≤ 4096 bytes for a huge transcript', () => {
    const lines: unknown[] = [];
    for (let i = 0; i < 2000; i++) {
      lines.push({
        type: 'user',
        cwd: '/w',
        timestamp: new Date(1_700_000_000_000 + i * 1000).toISOString(),
        message: { role: 'user', content: 'x'.repeat(500) + ` turn ${i}` },
      });
      lines.push({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', name: 'Bash', input: { command: `echo ${i}` } }],
        },
      });
    }
    const d = digestSession('huge', lines);
    const bytes = Buffer.byteLength(JSON.stringify(d), 'utf8');
    expect(bytes).toBeLessThanOrEqual(4096);
    expect(SessionDigestSchema.safeParse(d).success).toBe(true);
  });
});
