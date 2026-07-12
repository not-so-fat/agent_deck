import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  appendDaemonLogLine,
  openDaemonLogFd,
  resolveDaemonLogPath,
  resolveDaemonLogsDir,
} from './daemon-logs';

describe('daemon-logs', () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-deck-daemon-'));
    process.env.AGENT_DECK_HOME = tempHome;
  });

  afterEach(() => {
    delete process.env.AGENT_DECK_HOME;
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it('resolves log paths under AGENT_DECK_HOME', () => {
    expect(resolveDaemonLogsDir()).toBe(path.join(tempHome, 'logs'));
    expect(resolveDaemonLogPath('backend')).toBe(path.join(tempHome, 'logs', 'backend.log'));
  });

  it('opens append-only log fd with start marker', () => {
    const fd = openDaemonLogFd('supervisor');
    const content = fs.readFileSync(resolveDaemonLogPath('supervisor'), 'utf8');
    expect(content).toContain('--- supervisor');
    fs.closeSync(fd);
  });

  it('appends lines to log file', () => {
    appendDaemonLogLine('mcp', '[test] hello');
    expect(fs.readFileSync(resolveDaemonLogPath('mcp'), 'utf8')).toContain('[test] hello');
  });
});
