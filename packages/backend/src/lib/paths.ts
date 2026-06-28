import path from 'path';
import fs from 'fs';
import { getAgentDeckHome } from '../vault/yaml-sync';

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

export function resolveDatabasePath(): string {
  if (process.env.AGENT_DECK_DB_PATH?.trim()) {
    return path.resolve(process.env.AGENT_DECK_DB_PATH.trim());
  }

  const homeDb = path.join(getAgentDeckHome(), 'agent_deck.db');

  // Dev-only escape hatch (monorepo). npm/CLI installs always use ~/.agent-deck.
  if (process.env.AGENT_DECK_USE_CWD_DB === '1' || process.env.AGENT_DECK_USE_CWD_DB === 'true') {
    return path.resolve(process.cwd(), 'agent_deck.db');
  }

  return homeDb;
}
