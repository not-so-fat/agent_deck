import fs from 'node:fs';
import path from 'node:path';
import { resolveAgentDeckHome } from '@agent-deck/shared';

export type DaemonLogName = 'supervisor' | 'backend' | 'mcp';

export function resolveDaemonLogsDir(): string {
  return path.join(resolveAgentDeckHome(), 'logs');
}

export function resolveDaemonLogPath(name: DaemonLogName): string {
  return path.join(resolveDaemonLogsDir(), `${name}.log`);
}

/** Append-only log sink; returns fd for child stdio (caller does not close while process runs). */
export function openDaemonLogFd(name: DaemonLogName): number {
  const logPath = resolveDaemonLogPath(name);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const fd = fs.openSync(logPath, 'a');
  fs.writeSync(fd, `\n--- ${name} ${new Date().toISOString()} ---\n`);
  return fd;
}

export function appendDaemonLogLine(name: DaemonLogName, line: string): void {
  const logPath = resolveDaemonLogPath(name);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${line}\n`);
}

export function resolveCliEntry(): string {
  return process.argv[1] ?? path.join(__dirname, 'bin.js');
}
