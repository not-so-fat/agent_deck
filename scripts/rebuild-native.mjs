#!/usr/bin/env node
/**
 * Rebuild native addons for the active Node.js version.
 * better-sqlite3 binds to NODE_MODULE_VERSION — mismatch causes test/runtime failures
 * after switching Node majors without reinstalling.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

console.log(`[rebuild-native] Node ${process.version} — rebuilding better-sqlite3...`);
try {
  execSync('npm rebuild better-sqlite3', { cwd: root, stdio: 'inherit' });
  console.log('[rebuild-native] Done.');
} catch {
  console.error('[rebuild-native] Failed. Try: npm rebuild better-sqlite3');
  process.exit(1);
}
