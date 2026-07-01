import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installStatusline } from './statusline-setup';
import { runStatusline } from './statusline';

describe('release integration: status line user path', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ad-release-'));
    vi.stubEnv('HOME', tmpHome);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('installStatusline creates script and wires Claude settings', () => {
    const result = installStatusline('claude');

    expect(result.installed).toBe(true);
    expect(fs.existsSync(result.scriptPath)).toBe(true);
    expect(fs.statSync(result.scriptPath).mode & 0o111).not.toBe(0);

    const settings = JSON.parse(fs.readFileSync(result.configPath, 'utf8')) as {
      statusLine?: { type?: string; command?: string };
    };
    expect(settings.statusLine?.type).toBe('command');
    expect(settings.statusLine?.command).toBe(result.scriptPath);

    const script = fs.readFileSync(result.scriptPath, 'utf8');
    expect(script).toContain('NO_COLOR=1');
    expect(script).toContain('2>/dev/null');
  });

  it('runStatusline prints one clean line (no npm warn)', async () => {
    installStatusline('claude');

    const chunks: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      chunks.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    try {
      await runStatusline(['--workspace', '/tmp/no-binding-smoke']);
    } finally {
      process.stdout.write = originalWrite;
    }

    const output = chunks.join('').replace(/\n$/, '');
    const lines = output.split('\n').filter((line) => line.length > 0);
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toMatch(/npm warn/i);
    expect(lines[0]).toMatch(/^◆/);
  });
});
