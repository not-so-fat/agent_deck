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

  it('preserves workspaceRoot identity even when near the byte budget', () => {
    const workspaceRoot = '/Users/not_so_fat/workspace/codes/agent_deck';
    const lines: unknown[] = [];
    for (let i = 0; i < 800; i++) {
      lines.push({
        type: 'user',
        cwd: workspaceRoot,
        timestamp: new Date(1_700_000_000_000 + i * 1000).toISOString(),
        message: { role: 'user', content: `please fix this instead — turn ${i} ${'x'.repeat(200)}` },
      });
      lines.push({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              name: 'Edit',
              input: { file_path: `${workspaceRoot}/src/file-${i}.ts`, old_string: 'a', new_string: 'b' },
            },
          ],
        },
      });
    }
    const d = digestSession('near-budget', lines);
    expect(d.workspaceRoot).toBe(workspaceRoot);
    expect(Buffer.byteLength(JSON.stringify(d), 'utf8')).toBeLessThanOrEqual(4096);
    expect(SessionDigestSchema.safeParse(d).success).toBe(true);
  });

  it('keeps full workspaceRoot when cwd alone would exceed the budget (F1.5 wins)', () => {
    const cwd = `/${'w'.repeat(5000)}`;
    const d = digestSession('s', [
      {
        type: 'user',
        cwd,
        timestamp: '2024-01-01T00:00:00.000Z',
        message: { role: 'user', content: 'hi' },
      },
    ]);
    expect(d.workspaceRoot).toBe(cwd);
    expect(SessionDigestSchema.safeParse(d).success).toBe(true);
  });
});
