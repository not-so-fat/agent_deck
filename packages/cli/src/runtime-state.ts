import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface RunState {
  host: string;
  backendPort: number;
  mcpPort: number;
  backendPid: number;
  mcpPid: number;
  cliPid: number;
  startedAt: string;
}

function agentDeckHome(): string {
  return process.env.AGENT_DECK_HOME ?? path.join(os.homedir(), '.agent-deck');
}

export function runStatePath(): string {
  return path.join(agentDeckHome(), 'run.json');
}

export function readRunState(): RunState | null {
  try {
    const raw = fs.readFileSync(runStatePath(), 'utf8');
    return JSON.parse(raw) as RunState;
  } catch {
    return null;
  }
}

export function writeRunState(state: RunState): void {
  fs.mkdirSync(agentDeckHome(), { recursive: true });
  fs.writeFileSync(runStatePath(), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export function clearRunState(): void {
  try {
    fs.unlinkSync(runStatePath());
  } catch {
    // ignore
  }
}

export function isProcessAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
