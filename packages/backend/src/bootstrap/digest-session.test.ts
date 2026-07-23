import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SessionDigestSchema } from '@agent-deck/shared';
import { digestSession } from './digest-session';
import { extractUserText, isRealUserIntent } from './real-intent';

function loadFixture(name: string): unknown[] {
  const raw = fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
  return raw
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

describe('isRealUserIntent', () => {
  it('rejects toolUseResult echoes', () => {
    expect(
      isRealUserIntent({
        type: 'user',
        message: { role: 'user', content: 'ok' },
        toolUseResult: { ok: true },
      }),
    ).toBe(false);
  });

  it('rejects sidechain', () => {
    expect(
      isRealUserIntent({
        type: 'user',
        message: { role: 'user', content: 'hi' },
        isSidechain: true,
      }),
    ).toBe(false);
  });

  it('rejects mixed content blocks', () => {
    expect(
      isRealUserIntent({
        type: 'user',
        message: {
          role: 'user',
          content: [
            { type: 'tool_result', content: 'x' },
            { type: 'text', text: 'hi' },
          ],
        },
      }),
    ).toBe(false);
  });

  it('joins all-text content blocks', () => {
    const line = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          { type: 'text', text: 'first' },
          { type: 'text', text: 'second' },
        ],
      },
    };

    expect(isRealUserIntent(line)).toBe(true);
    expect(extractUserText(line)).toBe('first\nsecond');
  });
});

describe('digestSession', () => {
  it('parses qa-only fixture', () => {
    const digest = digestSession('sess-qa', loadFixture('qa-only.jsonl'));

    expect(SessionDigestSchema.safeParse(digest).success).toBe(true);
    expect(digest.workspaceRoot).toBe('/Users/x/proj');
    expect(digest.workspaceLabel).toBe('proj');
    expect(digest.turnCount).toBe(3);
    expect(digest.feedbackMoments).toEqual([]);
    expect(digest.outcome.signal).toBe('unknown');
  });

  it('excludes toolUseResult echoes', () => {
    const digest = digestSession('sess-tools', loadFixture('tool-echo.jsonl'));

    expect(digest.intents.map((intent) => intent.text)).toEqual(['real user request']);
    expect(digest.turnCount).toBe(1);
  });

  it('counts tools, files, skills, and outcome from with-tools', () => {
    const digest = digestSession('sess-tools', loadFixture('with-tools.jsonl'));

    expect(digest.tools.some((tool) => tool.name === 'Bash')).toBe(true);
    expect(digest.commands.some((command) => command.command === 'git commit')).toBe(true);
    expect(digest.topFiles.some((file) => file.path.endsWith('a.ts') && file.edits >= 1)).toBe(true);
    expect(digest.skills.some((skill) => skill.name === 'review' || skill.name === 'commit')).toBe(true);
    expect(digest.outcome.signal).toBe('committed');
    expect(digest.outcome.evidence).toMatch(/git commit/);
  });

  it('skips malformed lines without throwing', () => {
    const digest = digestSession('s', [{ type: 'user' }, 'not-json-object', { type: 'assistant' }]);

    expect(digest.skippedLineCount).toBeGreaterThanOrEqual(1);
  });

  it('is deterministic', () => {
    const lines = loadFixture('qa-only.jsonl');

    expect(JSON.stringify(digestSession('s', lines))).toBe(JSON.stringify(digestSession('s', lines)));
  });

  it('caps intents to the shared schema limit while counting all turns', () => {
    const lines = Array.from({ length: 41 }, (_, index) => ({
      type: 'user',
      message: { role: 'user', content: `request ${index}` },
    }));

    const digest = digestSession('s', lines);

    expect(digest.turnCount).toBe(41);
    expect(digest.intents).toHaveLength(40);
  });

  it('ignores empty user text', () => {
    const digest = digestSession('s', [
      { type: 'user', message: { role: 'user', content: '   ' } },
      { type: 'user', message: { role: 'user', content: 'real request' } },
    ]);

    expect(digest.turnCount).toBe(1);
    expect(digest.intents.map((intent) => intent.text)).toEqual(['real request']);
  });
});
