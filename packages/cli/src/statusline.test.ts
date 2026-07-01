import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { readStdin, resolveStatuslineWorkspace, runStatusline } from './statusline';

describe('statusline', () => {
  it('prefers --workspace over stdin cwd', () => {
    const workspace = resolveStatuslineWorkspace(
      ['--workspace', '/explicit'],
      JSON.stringify({ cwd: '/stdin' }),
    );
    expect(workspace).toBe('/explicit');
  });

  it('reads cwd from stdin payload', () => {
    const workspace = resolveStatuslineWorkspace(
      [],
      JSON.stringify({ cwd: '/from-stdin' }),
    );
    expect(workspace).toBe('/from-stdin');
  });

  it('reads workspace.project_dir from stdin payload', () => {
    const workspace = resolveStatuslineWorkspace(
      [],
      JSON.stringify({
        cwd: '/repo/packages/app',
        workspace: { project_dir: '/repo', current_dir: '/repo/packages/app' },
      }),
    );
    expect(workspace).toBe(path.resolve('/repo'));
  });

  it('falls back to process cwd when stdin is empty', () => {
    const workspace = resolveStatuslineWorkspace([], '');
    expect(workspace).toBe(process.cwd());
  });

  it('readStdin returns without hanging when stdin stays open', async () => {
    const input = new PassThrough();
    const original = process.stdin;
    Object.defineProperty(process, 'stdin', { value: input, configurable: true });

    try {
      const readPromise = readStdin(200);
      input.write(JSON.stringify({ cwd: '/open-stdin-workspace' }));
      const stdin = await readPromise;
      expect(stdin).toContain('/open-stdin-workspace');
    } finally {
      Object.defineProperty(process, 'stdin', { value: original, configurable: true });
    }
  });

  it('runStatusline completes when stdin stays open', async () => {
    const input = new PassThrough();
    const original = process.stdin;
    Object.defineProperty(process, 'stdin', { value: input, configurable: true });

    const chunks: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      chunks.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    try {
      const runPromise = runStatusline([]);
      input.write(JSON.stringify({ cwd: process.cwd() }));
      const code = await Promise.race([
        runPromise,
        new Promise<number>((_, reject) => {
          setTimeout(() => reject(new Error('runStatusline hung')), 3000);
        }),
      ]);
      expect(code).toBe(0);
      expect(chunks.join('')).toMatch(/^◆/);
    } finally {
      process.stdout.write = originalWrite;
      Object.defineProperty(process, 'stdin', { value: original, configurable: true });
    }
  });
});
