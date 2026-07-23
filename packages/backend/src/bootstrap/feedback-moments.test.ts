import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { digestSession } from './digest-session';
import { extractFeedbackMoments } from './feedback-moments';

function loadFixture(name: string): unknown[] {
  const raw = fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
  return raw
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

const editLine = {
  type: 'assistant',
  message: {
    role: 'assistant',
    content: [{ type: 'tool_use', name: 'Edit', input: { file_path: '/Users/x/proj/src/a.ts' } }],
  },
  timestamp: '2026-01-01T00:00:00.000Z',
};

const proseLine = {
  type: 'assistant',
  message: { role: 'assistant', content: [{ type: 'text', text: 'Updated the file as requested.' }] },
  timestamp: '2026-01-01T00:00:30.000Z',
};

function userLine(content: string): unknown {
  return {
    type: 'user',
    message: { role: 'user', content },
    timestamp: '2026-01-01T00:01:00.000Z',
  };
}

describe('feedback moments', () => {
  it('qa-only yields zero moments', () => {
    expect(digestSession('s', loadFixture('qa-only.jsonl')).feedbackMoments).toEqual([]);
  });

  it('captures negative marker moment', () => {
    const digest = digestSession('s', loadFixture('feedback-negative.jsonl'));

    expect(digest.feedbackMoments.length).toBeGreaterThanOrEqual(1);
    expect(digest.feedbackMoments[0]?.polarityHint).toBe('negative');
    expect(digest.feedbackMoments[0]?.markers.length).toBeGreaterThan(0);
    expect(digest.feedbackMoments[0]?.agentAction.length).toBeGreaterThan(0);
  });

  it('captures structural re-edit without markers', () => {
    const digest = digestSession('s', loadFixture('feedback-reedit.jsonl'));
    const structuralMoment = digest.feedbackMoments.find((moment) => moment.followupChange != null);

    expect(structuralMoment).toBeDefined();
    expect(structuralMoment?.polarityHint).toBe('unknown');
    expect(structuralMoment?.markers).toEqual([]);
  });

  it('excludes bare user turn after tool with no markers and no re-edit', () => {
    const moments = extractFeedbackMoments([editLine, userLine('Thanks, that looks fine.')]);

    expect(moments).toEqual([]);
  });

  it('keeps preceding tool action across prose-only assistant lines', () => {
    const moments = extractFeedbackMoments([editLine, proseLine, userLine("No, don't change that.")]);

    expect(moments).toHaveLength(1);
    expect(moments[0]?.polarityHint).toBe('negative');
    expect(moments[0]?.markers.length).toBeGreaterThan(0);
  });

  it('caps feedback moments at 30', () => {
    const events: unknown[] = [];
    for (let index = 0; index < 31; index += 1) {
      events.push(editLine, userLine('No, wrong.'));
    }

    expect(extractFeedbackMoments(events)).toHaveLength(30);
  });

  it('truncates oversized user reactions to schema max', () => {
    const hugeReaction = `${'x'.repeat(700)} wrong`;
    const moments = extractFeedbackMoments([editLine, userLine(hugeReaction)]);

    expect(moments).toHaveLength(1);
    expect(moments[0]?.userReaction.length).toBe(600);
  });

  it('captures positive marker polarity', () => {
    const moments = extractFeedbackMoments([editLine, userLine('Perfect, lgtm — ship it.')]);

    expect(moments).toHaveLength(1);
    expect(moments[0]?.polarityHint).toBe('positive');
    expect(moments[0]?.markers).toContain('perfect');
    expect(moments[0]?.markers).toContain('lgtm');
  });
});
