import path from 'node:path';
import { SessionDigestSchema, type SessionDigest } from '@agent-deck/shared';
import { extractUserText, isRealUserIntent } from './real-intent';

const EPOCH_ISO = '1970-01-01T00:00:00.000Z';

type TranscriptLine = {
  type?: unknown;
  cwd?: unknown;
  gitBranch?: unknown;
  timestamp?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toIsoTimestamp(value: unknown): string | undefined {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    return undefined;
  }

  return new Date(value).toISOString();
}

export function digestSession(sessionId: string, lines: unknown[]): SessionDigest {
  let workspaceRoot = '';
  let workspaceLabel: string | undefined;
  let gitBranch: string | null | undefined;
  let startedAt: string | undefined;
  let endedAt: string | undefined;
  let skippedLineCount = 0;
  let turnCount = 0;
  const intents: SessionDigest['intents'] = [];

  for (const line of lines) {
    try {
      if (!isRecord(line) || typeof line.type !== 'string') {
        skippedLineCount += 1;
        continue;
      }

      const transcriptLine = line as TranscriptLine;
      if (!workspaceRoot && typeof transcriptLine.cwd === 'string') {
        workspaceRoot = transcriptLine.cwd;
        workspaceLabel = path.basename(transcriptLine.cwd);
      }
      if (gitBranch === undefined && typeof transcriptLine.gitBranch === 'string') {
        gitBranch = transcriptLine.gitBranch;
      }

      const timestamp = toIsoTimestamp(transcriptLine.timestamp);
      if (timestamp) {
        startedAt ??= timestamp;
        endedAt = timestamp;
      }

      if (isRealUserIntent(line)) {
        turnCount += 1;
        const text = extractUserText(line);
        if (text !== null && intents.length < 40) {
          intents.push({
            text: text.slice(0, 280),
            ...(timestamp ? { at: timestamp } : {}),
          });
        }
      }
    } catch {
      skippedLineCount += 1;
    }
  }

  // Transcript lines may lack timestamps; epoch placeholders keep digestion deterministic.
  const digest = {
    schemaVersion: 1 as const,
    sessionId,
    workspaceRoot,
    ...(workspaceLabel ? { workspaceLabel } : {}),
    ...(gitBranch === undefined ? {} : { gitBranch }),
    startedAt: startedAt ?? EPOCH_ISO,
    endedAt: endedAt ?? EPOCH_ISO,
    turnCount,
    skippedLineCount,
    intents,
    commands: [],
    tools: [],
    skills: [],
    topFiles: [],
    feedbackMoments: [],
    outcome: { signal: 'unknown' as const },
  };

  return finalizeDigest(digest);
}

function finalizeDigest(digest: unknown): SessionDigest {
  const parsed = SessionDigestSchema.safeParse(digest);
  if (parsed.success) {
    return parsed.data;
  }

  const d = isRecord(digest) ? digest : {};
  const coerced = SessionDigestSchema.safeParse({
    schemaVersion: 1,
    sessionId: typeof d.sessionId === 'string' ? d.sessionId : 'unknown',
    workspaceRoot: typeof d.workspaceRoot === 'string' ? d.workspaceRoot : '',
    ...(typeof d.workspaceLabel === 'string' ? { workspaceLabel: d.workspaceLabel } : {}),
    ...(d.gitBranch === null || typeof d.gitBranch === 'string' ? { gitBranch: d.gitBranch } : {}),
    startedAt: typeof d.startedAt === 'string' ? d.startedAt : EPOCH_ISO,
    endedAt: typeof d.endedAt === 'string' ? d.endedAt : EPOCH_ISO,
    turnCount:
      typeof d.turnCount === 'number' && Number.isInteger(d.turnCount) && d.turnCount >= 0 ? d.turnCount : 0,
    ...(typeof d.skippedLineCount === 'number'
      ? { skippedLineCount: Math.max(0, Math.floor(d.skippedLineCount)) }
      : {}),
    intents: Array.isArray(d.intents) ? d.intents.slice(0, 40) : [],
    commands: [],
    tools: [],
    skills: [],
    topFiles: [],
    feedbackMoments: [],
    outcome: { signal: 'unknown' },
  });

  if (coerced.success) {
    return coerced.data;
  }

  return {
    schemaVersion: 1,
    sessionId: 'unknown',
    workspaceRoot: '',
    startedAt: EPOCH_ISO,
    endedAt: EPOCH_ISO,
    turnCount: 0,
    intents: [],
    commands: [],
    tools: [],
    skills: [],
    topFiles: [],
    feedbackMoments: [],
    outcome: { signal: 'unknown' },
  };
}
