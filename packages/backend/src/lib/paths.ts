import path from 'path';
import fs from 'fs';
import os from 'os';

/** Browser URL for the dashboard (OAuth return, docs). Bundled UI uses the API origin; dev uses Vite :3000. */
export function resolveDashboardOrigin(): string {
  if (process.env.AGENT_DECK_DASHBOARD_URL?.trim()) {
    return process.env.AGENT_DECK_DASHBOARD_URL.trim().replace(/\/$/, '');
  }

  const uiDist = process.env.AGENT_DECK_UI_DIST?.trim();
  if (uiDist && fs.existsSync(uiDist)) {
    const host = process.env.HOST ?? '127.0.0.1';
    const port = process.env.PORT ?? '8000';
    return `http://${host}:${port}`;
  }

  return 'http://localhost:3000';
}

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
 * Agent Deck data root: SQLite, credential yaml metadata, dev secret files, icons.
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

export function resolveDatabasePath(): string {
  if (process.env.AGENT_DECK_DB_PATH?.trim()) {
    return path.resolve(process.env.AGENT_DECK_DB_PATH.trim());
  }

  // Legacy monorepo escape hatch — prefer AGENT_DECK_DEV + ~/.agent-deck/dev.
  if (process.env.AGENT_DECK_USE_CWD_DB === '1' || process.env.AGENT_DECK_USE_CWD_DB === 'true') {
    return path.resolve(process.cwd(), 'agent_deck.db');
  }

  return path.join(resolveAgentDeckHome(), 'agent_deck.db');
}
