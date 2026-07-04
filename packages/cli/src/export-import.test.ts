import { describe, expect, it, vi } from 'vitest';
import { parseExportArgs, runExportCommand, runImportCommand } from './export-import';

describe('export/import CLI args', () => {
  it('parses export all', () => {
    expect(parseExportArgs(['all', '--output', 'backup.agent-deck.json'])).toEqual({
      ok: true,
      output: 'backup.agent-deck.json',
      scope: 'collection',
      deckId: undefined,
    });
  });

  it('parses export all with -o', () => {
    expect(parseExportArgs(['all', '-o', 'backup.json'])).toEqual({
      ok: true,
      output: 'backup.json',
      scope: 'collection',
      deckId: undefined,
    });
  });

  it('parses export deck', () => {
    expect(
      parseExportArgs([
        'deck',
        '22222222-2222-4222-8222-222222222222',
        '--output',
        'deck.json',
      ]),
    ).toEqual({
      ok: true,
      output: 'deck.json',
      scope: 'deck',
      deckId: '22222222-2222-4222-8222-222222222222',
    });
  });

  it('requires deck uuid', () => {
    const result = parseExportArgs(['deck', '--output', 'x.json']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('deck');
    }
  });

  it('requires --output', () => {
    const result = parseExportArgs(['all']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('--output');
    }
  });

  it('rejects unknown unit', () => {
    const result = parseExportArgs(['collection', '-o', 'x.json']);
    expect(result.ok).toBe(false);
  });

  it('runExportCommand prints usage on missing unit', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await runExportCommand([])).toBe(0);
    expect(log.mock.calls.some((call) => String(call[0]).includes('export all'))).toBe(
      true,
    );
    err.mockRestore();
    log.mockRestore();
  });

  it('runImportCommand requires a path', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await runImportCommand([])).toBe(1);
    expect(log.mock.calls.some((call) => String(call[0]).includes('agent-deck import'))).toBe(
      true,
    );
    err.mockRestore();
    log.mockRestore();
  });
});
