import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getAgentDeckVersion } from './version';

const PACKAGE_NAME = '@agent-deck/cli';
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface VersionCache {
  checkedAt: string;
  latest: string;
}

export interface UpgradeCheckResult {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  fromCache: boolean;
}

function agentDeckHome(): string {
  return process.env.AGENT_DECK_HOME ?? path.join(os.homedir(), '.agent-deck');
}

function cachePath(): string {
  return path.join(agentDeckHome(), 'version-check.json');
}

function readCache(): VersionCache | null {
  try {
    const raw = fs.readFileSync(cachePath(), 'utf8');
    return JSON.parse(raw) as VersionCache;
  } catch {
    return null;
  }
}

function writeCache(latest: string): void {
  fs.mkdirSync(agentDeckHome(), { recursive: true });
  const payload: VersionCache = {
    checkedAt: new Date().toISOString(),
    latest,
  };
  fs.writeFileSync(cachePath(), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export function compareSemver(a: string, b: string): number {
  const parse = (value: string) => value.replace(/^v/, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const left = parse(a);
  const right = parse(b);

  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) {
      return diff > 0 ? 1 : -1;
    }
  }

  return 0;
}

export async function fetchLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch(REGISTRY_URL, {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

export async function checkForUpgrade(options: { force?: boolean } = {}): Promise<UpgradeCheckResult> {
  const current = getAgentDeckVersion();
  const cache = readCache();

  if (!options.force && cache?.latest) {
    const age = Date.now() - Date.parse(cache.checkedAt);
    if (Number.isFinite(age) && age >= 0 && age < CACHE_TTL_MS) {
      return {
        current,
        latest: cache.latest,
        updateAvailable: compareSemver(cache.latest, current) > 0,
        fromCache: true,
      };
    }
  }

  const latest = await fetchLatestVersion();
  if (latest) {
    writeCache(latest);
  }

  return {
    current,
    latest,
    updateAvailable: latest ? compareSemver(latest, current) > 0 : false,
    fromCache: false,
  };
}

function runNpmInstallGlobal(version: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn('npm', ['install', '-g', `${PACKAGE_NAME}@${version}`], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', () => resolve(1));
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

export async function runUpgrade(args: string[]): Promise<number> {
  const checkOnly = args.includes('--check');
  const result = await checkForUpgrade({ force: true });

  if (!result.latest) {
    console.error('Could not reach npm registry to check for updates.');
    return 1;
  }

  console.log(`Current: ${result.current}`);
  console.log(`Latest:  ${result.latest}`);

  if (!result.updateAvailable) {
    console.log('Already on the latest version.');
    return 0;
  }

  if (checkOnly) {
    console.log('Update available. Run: agent-deck upgrade');
    return 0;
  }

  console.log(`Upgrading ${PACKAGE_NAME} → ${result.latest} ...`);
  const code = await runNpmInstallGlobal(result.latest);
  if (code === 0) {
    console.log('Upgrade complete. Restart any running Agent Deck process.');
  } else {
    console.error('Upgrade failed. Try manually:');
    console.error(`  npm install -g ${PACKAGE_NAME}@${result.latest}`);
    console.error('Or use without global install:');
    console.error(`  npx ${PACKAGE_NAME}@${result.latest} start`);
  }

  return code;
}

export async function maybeAutoUpgradeOnStart(): Promise<void> {
  const enabled =
    process.env.AGENT_DECK_AUTO_UPGRADE === '1' ||
    process.env.AGENT_DECK_AUTO_UPGRADE === 'true';

  if (!enabled) {
    return;
  }

  const result = await checkForUpgrade();
  if (!result.updateAvailable || !result.latest) {
    return;
  }

  console.log(`[agent-deck] Update available: ${result.current} → ${result.latest}`);
  const code = await runNpmInstallGlobal(result.latest);
  if (code !== 0) {
    console.warn('[agent-deck] Auto-upgrade failed; continuing with current version.');
  }
}

export async function notifyIfUpdateAvailable(): Promise<void> {
  if (
    process.env.AGENT_DECK_AUTO_UPGRADE === '1' ||
    process.env.AGENT_DECK_AUTO_UPGRADE === 'true' ||
    process.env.AGENT_DECK_NO_UPDATE_CHECK === '1' ||
    process.env.AGENT_DECK_NO_UPDATE_CHECK === 'true'
  ) {
    return;
  }

  const result = await checkForUpgrade();
  if (!result.updateAvailable || !result.latest) {
    return;
  }

  console.log(
    `[agent-deck] Update available: ${result.current} → ${result.latest}  (agent-deck upgrade, or npx ${PACKAGE_NAME}@latest start)`,
  );
}
