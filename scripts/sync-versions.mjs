#!/usr/bin/env node
/**
 * Sync semver across publishable workspace packages.
 * Usage: node scripts/sync-versions.mjs 1.1.0
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error('Usage: node scripts/sync-versions.mjs <semver>');
  process.exit(1);
}

const targets = [
  'package.json',
  'packages/shared/package.json',
  'packages/backend/package.json',
  'packages/cli/package.json',
  'apps/agent-deck/package.json',
  'server.json',
];

for (const relativePath of targets) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    continue;
  }

  if (relativePath.endsWith('server.json')) {
    const serverJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    serverJson.version = version;
    if (Array.isArray(serverJson.packages)) {
      for (const pkg of serverJson.packages) {
        pkg.version = version;
      }
    }
    fs.writeFileSync(filePath, `${JSON.stringify(serverJson, null, 2)}\n`);
    console.log(`Updated ${relativePath} -> ${version}`);
    continue;
  }

  const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  pkg.version = version;

  if (relativePath === 'packages/cli/package.json' && pkg.dependencies) {
    for (const name of ['@agent-deck/backend', '@agent-deck/shared']) {
      if (pkg.dependencies[name]) {
        pkg.dependencies[name] = `^${version}`;
      }
    }
  }

  if (relativePath === 'packages/backend/package.json' && pkg.dependencies?.['@agent-deck/shared']) {
    pkg.dependencies['@agent-deck/shared'] = `^${version}`;
  }

  fs.writeFileSync(filePath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`Updated ${relativePath} -> ${version}`);
}

console.log(`\nSynced version ${version}. Next: npm install && npm run build:release`);
