import { describe, expect, it } from 'vitest';
import path from 'node:path';
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
});
