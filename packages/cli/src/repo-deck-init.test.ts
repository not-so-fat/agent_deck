import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureRepoDeckManifest } from './repo-deck-init';

describe('repo-deck-init', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ad-deck-init-'));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/api/decks')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: [{ id: '6e825b59-13de-4ddd-ab7e-55ab5a1c279a', name: 'dev' }],
            }),
          };
        }
        if (url.includes('/api/decks/761f3c44')) {
          return { ok: false, status: 404, json: async () => ({ success: false }) };
        }
        if (url.includes('/api/decks/6e825b59')) {
          return {
            ok: true,
            json: async () => ({ success: true, data: { name: 'dev' } }),
          };
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates deck.yaml when missing', async () => {
    const result = await ensureRepoDeckManifest(tmpDir, {
      host: '127.0.0.1',
      backendPort: 11111,
    });
    expect(result.action).toBe('created');
    expect(fs.existsSync(path.join(tmpDir, '.agent-deck', 'deck.yaml'))).toBe(true);
  });

  it('updates deck.yaml when deck_id is invalid', async () => {
    const manifestDir = path.join(tmpDir, '.agent-deck');
    fs.mkdirSync(manifestDir, { recursive: true });
    fs.writeFileSync(
      path.join(manifestDir, 'deck.yaml'),
      'deck_id: 761f3c44-21b3-4298-81e4-4c85bb963eb1\nname: dev\n',
    );

    const result = await ensureRepoDeckManifest(tmpDir, {
      host: '127.0.0.1',
      backendPort: 11111,
    });
    expect(result.action).toBe('updated');
    const content = fs.readFileSync(path.join(manifestDir, 'deck.yaml'), 'utf8');
    expect(content).toContain('6e825b59-13de-4ddd-ab7e-55ab5a1c279a');
  });
});
