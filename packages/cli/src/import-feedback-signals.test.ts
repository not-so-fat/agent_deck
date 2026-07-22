import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectSignalsFromDir, parseTranscriptFile } from './import-feedback-signals';

describe('import-feedback-signals', () => {
  it('detects correction-like user turns in JSONL', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ad-transcript-'));
    const file = path.join(dir, 'session.jsonl');
    fs.writeFileSync(
      file,
      [
        JSON.stringify({
          type: 'user',
          message: { role: 'user', content: 'just add one line to Gotchas, do not rewrite' },
        }),
        JSON.stringify({
          type: 'user',
          message: { role: 'user', content: 'hello' },
        }),
        JSON.stringify({
          type: 'assistant',
          message: { role: 'assistant', content: 'ok' },
        }),
      ].join('\n'),
      'utf8',
    );

    const signals = parseTranscriptFile(file);
    expect(signals).toHaveLength(1);
    expect(signals[0].userFeedbackExcerpt).toMatch(/Gotchas/i);
    expect(signals[0].source).toBe('backfill');

    const fromDir = collectSignalsFromDir(dir);
    expect(fromDir).toHaveLength(1);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
