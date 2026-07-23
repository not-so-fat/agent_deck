import { SessionDigestSchema, type SessionDigest } from '@agent-deck/shared';
import { deriveOutcome, normalizeBashCommand, summarizeAssistantAction } from './extractors';
import { extractFeedbackMoments } from './feedback-moments';
import { extractUserText, isRealUserIntent } from './real-intent';

const EPOCH_ISO = '1970-01-01T00:00:00.000Z';
const DIGEST_BYTE_BUDGET = 4096;
/** Skip tiny intents after envelope unwrap (shared quality floor with Claude shortening floor spirit). */
const MIN_INTENT_TEXT_LENGTH = 8;

export type DigestCursorSessionOptions = {
  /** Absolute --workspace path when this project was selected via slug encode match. */
  workspaceRoot?: string;
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

function increment(counts: Map<string, number>, values: string[]): void {
  for (const value of values) {
    if (value) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
}

function sortedCounts(counts: Map<string, number>) {
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

/**
 * Cursor agent-transcript JSONL → SessionDigest (F1C).
 * `projectSlug` becomes workspaceLabel + workspaceSlug; workspaceRoot is abs --workspace when provided, else the slug (opaque).
 */
export function digestCursorSession(
  sessionId: string,
  lines: unknown[],
  projectSlug: string,
  options: DigestCursorSessionOptions = {},
): SessionDigest {
  const workspaceRoot = options.workspaceRoot ?? projectSlug;
  const workspaceLabel = projectSlug;
  const workspaceSlug = projectSlug;
  let startedAt: string | undefined;
  let endedAt: string | undefined;
  let skippedLineCount = 0;
  let turnCount = 0;
  const intents: SessionDigest['intents'] = [];
  const toolCounts = new Map<string, number>();
  const commandCounts = new Map<string, number>();
  const fileCounts = new Map<string, number>();

  for (const line of lines) {
    try {
      if (!isRecord(line)) {
        skippedLineCount += 1;
        continue;
      }

      const timestamp = toIsoTimestamp(line.timestamp);
      if (timestamp) {
        startedAt ??= timestamp;
        endedAt = timestamp;
      }

      const action = summarizeAssistantAction(line);
      increment(toolCounts, action.toolNames);
      increment(
        commandCounts,
        action.bashCommands.map(normalizeBashCommand).filter(Boolean),
      );
      increment(fileCounts, action.filePaths);

      if (isRealUserIntent(line)) {
        turnCount += 1;
        const text = extractUserText(line);
        if (text !== null && text.length >= MIN_INTENT_TEXT_LENGTH && intents.length < 40) {
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

  const allCommands = sortedCounts(commandCounts).map(({ value: command, count }) => ({
    command,
    count,
  }));

  let feedbackMoments: SessionDigest['feedbackMoments'] = [];
  try {
    feedbackMoments = extractFeedbackMoments(lines).filter((moment) => !looksLikeSkillBoilerplate(moment.userReaction));
  } catch {
    skippedLineCount += 1;
  }

  const digest = {
    schemaVersion: 1 as const,
    host: 'cursor' as const,
    sessionId,
    workspaceRoot,
    workspaceLabel,
    workspaceSlug,
    startedAt: startedAt ?? EPOCH_ISO,
    endedAt: endedAt ?? EPOCH_ISO,
    turnCount,
    skippedLineCount,
    intents,
    commands: allCommands.slice(0, 40),
    tools: sortedCounts(toolCounts)
      .slice(0, 40)
      .map(({ value: name, count }) => ({ name, count })),
    skills: [] as SessionDigest['skills'],
    topFiles: [...fileCounts.entries()]
      .map(([filePath, edits]) => ({ path: filePath, edits }))
      .sort((left, right) => right.edits - left.edits || left.path.localeCompare(right.path))
      .slice(0, 20),
    feedbackMoments,
    outcome: deriveOutcome(allCommands),
  };

  return finalizeCursorDigest(digest);
}

function looksLikeSkillBoilerplate(text: string): boolean {
  return (
    text.includes('Base directory for this skill:') ||
    text.includes('<HARD-GATE>') ||
    (text.length > 400 && text.includes('# ') && text.includes('Skill'))
  );
}

function finalizeCursorDigest(digest: unknown): SessionDigest {
  const parsed = SessionDigestSchema.safeParse(digest);
  if (!parsed.success) {
    return {
      schemaVersion: 1,
      host: 'cursor',
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

  let current = parsed.data;
  // Shared NFR-2: drop list payloads until under budget; never truncate identity fields.
  for (let guard = 0; guard < 200 && Buffer.byteLength(JSON.stringify(current), 'utf8') > DIGEST_BYTE_BUDGET; guard += 1) {
    let changed = false;
    for (const field of ['feedbackMoments', 'topFiles', 'tools', 'commands', 'intents'] as const) {
      if (Buffer.byteLength(JSON.stringify(current), 'utf8') <= DIGEST_BYTE_BUDGET) {
        break;
      }
      const items = current[field];
      if (Array.isArray(items) && items.length > 0) {
        current = { ...current, [field]: items.slice(0, -1) };
        changed = true;
      }
    }
    if (!changed) {
      break;
    }
  }

  const again = SessionDigestSchema.safeParse(current);
  return again.success ? again.data : parsed.data;
}
