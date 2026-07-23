import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { digestSession } from './digest-session';

function loadFixture(name: string): unknown[] {
  const raw = fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
  return raw
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
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
});
