import { describe, expect, it, vi } from 'vitest';

import {
  runDeckCommand,
  runPlaybookCommand,
  runServiceCommand,
} from './collection-admin';

/** CLI argument wiring (DB behavior covered in backend cli-runtime.test.ts). */
describe('collection-admin CLI commands', () => {
  it('requires ids for delete subcommands', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await runServiceCommand(['delete'])).toBe(1);
    expect(await runPlaybookCommand(['delete'])).toBe(1);
    expect(await runDeckCommand(['delete'])).toBe(1);
    err.mockRestore();
  });

  it('prints usage for unknown subcommands', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await runServiceCommand(['nope'])).toBe(1);
    expect(await runPlaybookCommand([])).toBe(1);
    expect(await runDeckCommand(['help'])).toBe(1);
    expect(log.mock.calls.some((call) => String(call[0]).includes('agent-deck service'))).toBe(true);
    log.mockRestore();
  });
});
