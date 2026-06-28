import path from 'path';
import fs from 'fs';
import { getAgentDeckHome } from '../vault/yaml-sync';

export function resolveDatabasePath(): string {
  if (process.env.AGENT_DECK_DB_PATH) {
    return path.resolve(process.env.AGENT_DECK_DB_PATH);
  }

  const homeDb = path.join(getAgentDeckHome(), 'agent_deck.db');
  const cwdDb = path.resolve(process.cwd(), 'agent_deck.db');

  if (fs.existsSync(homeDb)) {
    return homeDb;
  }

  if (fs.existsSync(cwdDb)) {
    return cwdDb;
  }

  return homeDb;
}
