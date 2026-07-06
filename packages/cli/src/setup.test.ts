import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveSetupMenubar, resolveSetupStatusline, runSetup } from './setup';

describe('setup statusline defaults', () => {
  it('enables status line for Claude Code by default', () => {
    expect(resolveSetupStatusline('claude')).toBe(true);
  });

  it('enables status line for Cursor CLI by default', () => {
    expect(resolveSetupStatusline('cursor')).toBe(true);
  });

  it('skips status line for Claude Desktop by default', () => {
    expect(resolveSetupStatusline('claude-desktop')).toBe(false);
  });

  it('honors --no-statusline', () => {
    expect(resolveSetupStatusline('claude', false)).toBe(false);
  });

  it('honors explicit --statusline for claude-desktop', () => {
    expect(resolveSetupStatusline('claude-desktop', true)).toBe(true);
  });

  it('enables menubar on macOS by default', () => {
    const expected = process.platform === 'darwin';
    expect(resolveSetupMenubar('cursor')).toBe(expected);
    expect(resolveSetupMenubar('claude')).toBe(expected);
  });

  it('honors --no-menubar', () => {
    expect(resolveSetupMenubar('cursor', false)).toBe(false);
  });

  it.skipIf(process.platform !== 'darwin')(
    'setup --menubar alone installs only the SwiftBar plugin',
    async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-deck-setup-menubar-'));
    process.env.AGENT_DECK_SWIFTBAR_DIR = tmpDir;
    try {
      const code = await runSetup(['--menubar']);
      expect(code).toBe(0);
      expect(fs.existsSync(path.join(tmpDir, 'agent-deck.3s.sh'))).toBe(true);
    } finally {
      delete process.env.AGENT_DECK_SWIFTBAR_DIR;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  },
  );
});
