import fs from 'node:fs';
import path from 'node:path';

export function resolveBackendRoot(): string {
  const mainEntry = require.resolve('@agent-deck/backend');
  return path.join(path.dirname(mainEntry), '..');
}

export function resolveBackendEntry(name: 'index' | 'mcp-index'): string {
  const root = resolveBackendRoot();
  const distPath = path.join(root, 'dist', `${name}.js`);
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Backend build not found at ${distPath}. Run npm run build in the repo root.`,
    );
  }
  return distPath;
}

export function resolveUiDist(): string | undefined {
  if (process.env.AGENT_DECK_UI_DIST) {
    const custom = path.resolve(process.env.AGENT_DECK_UI_DIST);
    return fs.existsSync(custom) ? custom : undefined;
  }

  const bundled = path.join(resolveBackendRoot(), 'static-ui');
  return fs.existsSync(bundled) ? bundled : undefined;
}
