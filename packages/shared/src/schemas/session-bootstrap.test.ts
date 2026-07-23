import { describe, expect, it } from 'vitest';
import { SessionDigestSchema, FeedbackMomentSchema, BootstrapManifestSchema } from './session-bootstrap';

describe('session-bootstrap schemas', () => {
  it('rejects abandoned outcome signal', () => {
    const r = SessionDigestSchema.safeParse({
      schemaVersion: 1,
      sessionId: 's1',
      workspaceRoot: '/tmp/w',
      startedAt: '2026-01-01T00:00:00.000Z',
      turnCount: 0,
      intents: [],
      feedbackMoments: [],
      outcome: { signal: 'abandoned' },
    });
    expect(r.success).toBe(false);
  });

  it('accepts minimal valid digest', () => {
    const r = SessionDigestSchema.safeParse({
      schemaVersion: 1,
      sessionId: 's1',
      workspaceRoot: '/tmp/w',
      startedAt: '2026-01-01T00:00:00.000Z',
      turnCount: 0,
      intents: [],
      feedbackMoments: [],
      outcome: { signal: 'unknown' },
    });
    expect(r.success).toBe(true);
  });

  it('requires polarityHint on FeedbackMoment', () => {
    const r = FeedbackMomentSchema.safeParse({
      agentAction: 'Edited foo.ts',
      userReaction: 'no, use basename',
      markers: ['no'],
    });
    expect(r.success).toBe(false);
  });

  it('accepts BootstrapManifest with guideRef', () => {
    const r = BootstrapManifestSchema.safeParse({
      schemaVersion: 1,
      generatedAt: '2026-01-01T00:00:00.000Z',
      digestDir: '/tmp/out',
      guideRef: '/tmp/out/authoring-guide.md',
      totalSessions: 0,
      workspaces: [],
    });
    expect(r.success).toBe(true);
  });
});
