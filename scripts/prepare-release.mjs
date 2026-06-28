#!/usr/bin/env node
/**
 * Build all workspaces and copy the dashboard bundle into @agent-deck/backend/static-ui
 * for npm publish (served when AGENT_DECK_UI_DIST is set by agent-deck start).
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const frontendDist = path.join(root, 'apps/agent-deck/dist');
const backendStatic = path.join(root, 'packages/backend/static-ui');

console.log('[prepare-release] Building workspaces ...');
execSync('npm run build', { cwd: root, stdio: 'inherit' });

if (!fs.existsSync(frontendDist)) {
  console.error(`[prepare-release] Missing frontend build at ${frontendDist}`);
  process.exit(1);
}

console.log(`[prepare-release] Copying UI to ${backendStatic} ...`);
fs.rmSync(backendStatic, { recursive: true, force: true });
fs.cpSync(frontendDist, backendStatic, { recursive: true });

console.log('[prepare-release] Done. Publish order: @agent-deck/shared -> @agent-deck/backend -> @agent-deck/cli');
