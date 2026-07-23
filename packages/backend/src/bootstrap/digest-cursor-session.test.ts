import { describe, expect, it } from 'vitest';
import { SessionDigestSchema } from '@agent-deck/shared';
import { encodeCursorProjectSlug } from './cursor-project-slug';
import { digestCursorSession } from './digest-cursor-session';
import fs from 'node:fs';
import path from 'node:path';

function loadFixture(name: string): unknown[] {
  const raw = fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
  return raw
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

describe('encodeCursorProjectSlug', () => {
  it('encodes absolute unix paths the Cursor way (slashes and underscores → hyphens)', () => {
    expect(encodeCursorProjectSlug('/Users/not_so_fat/workspace/codes/agent_deck')).toBe(
      'Users-not-so-fat-workspace-codes-agent-deck',
    );
  });
});

describe('digestCursorSession', () => {
  it('unwraps envelopes, drops host injections, and captures real negative feedback', () => {
    const d = digestCursorSession(
      'sess-tools',
      loadFixture('cursor-with-tools.jsonl'),
      'Users-x-proj',
      { workspaceRoot: '/Users/x/proj' },
    );
    expect(SessionDigestSchema.safeParse(d).success).toBe(true);
    expect(d.host).toBe('cursor');
    expect(d.workspaceRoot).toBe('/Users/x/proj');
    expect(d.workspaceLabel).toBe('Users-x-proj');
    expect(d.workspaceSlug).toBe('Users-x-proj');
    expect(d.intents.map((intent) => intent.text)).toEqual([
      'fix the bootstrap path please',
      "don't use that approach, revert it",
    ]);
    expect(d.tools.some((tool) => tool.name === 'Shell')).toBe(true);
    expect(d.commands.some((command) => command.command === 'git commit')).toBe(true);
    expect(d.topFiles.some((file) => file.path.endsWith('a.ts') && file.edits >= 1)).toBe(true);
    expect(d.outcome.signal).toBe('committed');
    expect(d.feedbackMoments.length).toBe(1);
    expect(d.feedbackMoments[0]?.userReaction).toBe("don't use that approach, revert it");
    expect(d.feedbackMoments[0]?.polarityHint).toBe('negative');
  });

  it('qa-only yields unwrapped intent and zero feedback moments', () => {
    const d = digestCursorSession('sess-qa', loadFixture('cursor-qa-only.jsonl'), 'Users-x-proj');
    expect(d.host).toBe('cursor');
    expect(d.workspaceRoot).toBe('Users-x-proj');
    expect(d.workspaceSlug).toBe('Users-x-proj');
    expect(d.intents).toEqual([{ text: 'what is a digest?' }]);
    expect(d.feedbackMoments).toEqual([]);
    expect(d.turnCount).toBe(1);
  });
});
