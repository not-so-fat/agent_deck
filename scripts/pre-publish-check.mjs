#!/usr/bin/env node
/**
 * Gate npm publish — runs the monorepo test suite and exits non-zero on failure.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

console.log('[pre-publish] Rebuilding native modules for current Node...');
try {
  execSync('node scripts/rebuild-native.mjs', { cwd: root, stdio: 'inherit' });
} catch {
  console.error('[pre-publish] Native rebuild failed — publish aborted.');
  process.exit(1);
}

console.log('[pre-publish] Running publishable package tests (shared, backend, cli, frontend) ...');
try {
  execSync(
    'npx turbo run test --filter=@agent-deck/shared --filter=@agent-deck/backend --filter=@agent-deck/cli --filter=@agent-deck/frontend',
    { cwd: root, stdio: 'inherit' },
  );
} catch {
  console.error('[pre-publish] Tests failed — publish aborted.');
  process.exit(1);
}

console.log('[pre-publish] Tests passed.');
