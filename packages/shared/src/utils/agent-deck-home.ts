import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Dev monorepo / tsx — separate data dir from production `agent-deck start`. */
export function isAgentDeckDevMode(): boolean {
  const flag = process.env.AGENT_DECK_DEV?.trim().toLowerCase();
  if (flag === '1' || flag === 'true' || flag === 'yes') {
    return true;
  }
  if (flag === '0' || flag === 'false' || flag === 'no') {
    return false;
  }
  return process.env.NODE_ENV === 'development';
}

/**
 * Agent Deck data root: SQLite, credential yaml metadata, bindings sidecar, dev secret files.
 * Production CLI → ~/.agent-deck
 * Monorepo dev (AGENT_DECK_DEV=1) → ~/.agent-deck/dev
 */
export function resolveAgentDeckHome(): string {
  if (process.env.AGENT_DECK_HOME?.trim()) {
    return path.resolve(process.env.AGENT_DECK_HOME.trim());
  }

  const base = path.join(os.homedir(), '.agent-deck');
  return isAgentDeckDevMode() ? path.join(base, 'dev') : base;
}

export function resolveBindingsFilePath(): string {
  return path.join(resolveAgentDeckHome(), 'bindings.json');
}

/** Prod + dev sidecar paths (statusline / display must see binds from either workflow). */
export function listBindingsFileCandidates(): string[] {
  const base = path.join(os.homedir(), '.agent-deck');
  const candidates = [
    process.env.AGENT_DECK_HOME?.trim()
      ? path.join(path.resolve(process.env.AGENT_DECK_HOME.trim()), 'bindings.json')
      : undefined,
    resolveBindingsFilePath(),
    path.join(base, 'bindings.json'),
    path.join(base, 'dev', 'bindings.json'),
  ].filter((value): value is string => Boolean(value));

  return [...new Set(candidates)];
}
