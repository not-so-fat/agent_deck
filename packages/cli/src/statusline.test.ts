import { describe, expect, it } from 'vitest';
import { resolveStatuslineWorkspace } from './statusline';

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

  it('falls back to process cwd when stdin is empty', () => {
    const workspace = resolveStatuslineWorkspace([], '');
    expect(workspace).toBe(process.cwd());
  });
});
