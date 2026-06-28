import fs from 'node:fs';
import path from 'node:path';

/** Runtime version from the published @agent-deck/backend package. */
export function getAgentDeckVersion(): string {
  try {
    const pkgPath = path.join(__dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return process.env.AGENT_DECK_VERSION ?? '0.0.0';
  }
}
