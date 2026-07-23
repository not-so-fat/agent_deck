import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const BOOTSTRAP_DIR = path.join(__dirname);

const BANNED_IMPORT_PATTERN =
  /^import\s.+from\s['"].*(?:openai|anthropic|@ai-sdk|node-fetch|undici)/i;
const BANNED_CALL_PATTERN = /(?:^|\s)(?:fetch|axios)\s*\(/i;

describe('bootstrap no-LLM import guard', () => {
  it('does not import LLM or HTTP client libraries in bootstrap/*.ts', () => {
    const sourceFiles = fs
      .readdirSync(BOOTSTRAP_DIR)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .map((name) => path.join(BOOTSTRAP_DIR, name));

    const violations: string[] = [];

    for (const filePath of sourceFiles) {
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (BANNED_IMPORT_PATTERN.test(line) || BANNED_CALL_PATTERN.test(line)) {
          violations.push(`${path.basename(filePath)}:${index + 1}: ${line.trim()}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
