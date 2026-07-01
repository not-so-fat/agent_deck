import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BindingsFileSchema, formatDisplayLine } from '@agent-deck/shared';

function readSidecarLineForTest(workspaceRoot: string, bindingsPath: string): string | null {
  try {
    const raw = fs.readFileSync(bindingsPath, 'utf8');
    const parsed = BindingsFileSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return null;
    }
    const entry = parsed.data[workspaceRoot];
    if (!entry) {
      return null;
    }
    return formatDisplayLine(entry.deckName, entry.cardCounts);
  } catch {
    return null;
  }
}

describe('display-client sidecar', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-deck-ext-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('formats a cached binding entry', () => {
    const workspace = '/Users/me/repo';
    const bindingsPath = path.join(tempDir, 'bindings.json');
    fs.writeFileSync(
      bindingsPath,
      JSON.stringify({
        [workspace]: {
          deckId: '123e4567-e89b-12d3-a456-426614174000',
          deckName: 'dev',
          source: 'session_override',
          updatedAt: '2026-01-01T00:00:00.000Z',
          cardCounts: { mcp: 2, credentials: 0, playbooks: 1 },
        },
      }),
      'utf8',
    );

    expect(readSidecarLineForTest(workspace, bindingsPath)).toBe(
      '◆ dev · 2 MCP · 0 keys · 1 playbooks',
    );
  });
});
