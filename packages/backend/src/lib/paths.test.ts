import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveDatabasePath } from './paths';

describe('resolveDatabasePath', () => {
  const originalEnv = { ...process.env };
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-deck-paths-'));
    process.env.AGENT_DECK_HOME = path.join(tempDir, 'home');
    fs.mkdirSync(process.env.AGENT_DECK_HOME, { recursive: true });
    delete process.env.AGENT_DECK_DB_PATH;
    delete process.env.AGENT_DECK_USE_CWD_DB;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('uses ~/.agent-deck even when cwd has agent_deck.db', () => {
    const cwdDb = path.join(process.cwd(), 'agent_deck.db');
    const hadCwdDb = fs.existsSync(cwdDb);
    const homeDb = path.join(process.env.AGENT_DECK_HOME!, 'agent_deck.db');

    try {
      if (!hadCwdDb) {
        fs.writeFileSync(cwdDb, '');
      }

      expect(resolveDatabasePath()).toBe(homeDb);
    } finally {
      if (!hadCwdDb && fs.existsSync(cwdDb)) {
        fs.unlinkSync(cwdDb);
      }
    }
  });

  it('honors AGENT_DECK_DB_PATH', () => {
    const custom = path.join(tempDir, 'custom.db');
    process.env.AGENT_DECK_DB_PATH = custom;
    expect(resolveDatabasePath()).toBe(custom);
  });

  it('uses cwd db only when AGENT_DECK_USE_CWD_DB=1', () => {
    const cwdDb = path.join(process.cwd(), 'agent_deck.db');
    const hadCwdDb = fs.existsSync(cwdDb);

    try {
      if (!hadCwdDb) {
        fs.writeFileSync(cwdDb, '');
      }
      process.env.AGENT_DECK_USE_CWD_DB = '1';
      expect(resolveDatabasePath()).toBe(cwdDb);
    } finally {
      if (!hadCwdDb && fs.existsSync(cwdDb)) {
        fs.unlinkSync(cwdDb);
      }
    }
  });
});
