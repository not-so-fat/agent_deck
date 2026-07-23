import path from 'node:path';
import { SessionDigestSchema, type SessionDigest } from '@agent-deck/shared';
import { deriveOutcome, extractSkillsFromUserText, normalizeBashCommand, summarizeAssistantAction } from './extractors';
import { extractFeedbackMoments } from './feedback-moments';
import { extractUserText, isRealUserIntent } from './real-intent';

const EPOCH_ISO = '1970-01-01T00:00:00.000Z';
const DIGEST_BYTE_BUDGET = 4096;
const MIN_INTENT_TEXT_LENGTH = 40;
const MIN_COMMAND_TEXT_LENGTH = 20;
const MIN_SCALAR_TEXT_LENGTH = 20;

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

export function digestSession(sessionId: string, lines: unknown[]): SessionDigest {
  let workspaceRoot = '';
  let workspaceLabel: string | undefined;
  let gitBranch: string | null | undefined;
  let startedAt: string | undefined;
  let endedAt: string | undefined;
  let skippedLineCount = 0;
  let turnCount = 0;
  const intents: SessionDigest['intents'] = [];
  const toolCounts = new Map<string, number>();
  const commandCounts = new Map<string, number>();
  const skillCounts = new Map<string, number>();
  const fileCounts = new Map<string, number>();

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

      const action = summarizeAssistantAction(line);
      increment(toolCounts, action.toolNames);
      increment(
        commandCounts,
        action.bashCommands.map(normalizeBashCommand).filter(Boolean),
      );
      increment(skillCounts, action.skills);
      increment(fileCounts, action.filePaths);

      if (isRealUserIntent(line)) {
        turnCount += 1;
        const text = extractUserText(line);
        if (text !== null) {
          increment(skillCounts, extractSkillsFromUserText(text));
          if (intents.length < 40) {
            intents.push({
              text: text.slice(0, 280),
              ...(timestamp ? { at: timestamp } : {}),
            });
          }
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
  const commands = allCommands.slice(0, 40);
  const tools = sortedCounts(toolCounts)
    .slice(0, 40)
    .map(({ value: name, count }) => ({ name, count }));
  const skills = sortedCounts(skillCounts)
    .slice(0, 40)
    .map(({ value: name, count }) => ({ name, count }));
  const topFiles = [...fileCounts.entries()]
    .map(([path, edits]) => ({ path, edits }))
    .sort((left, right) => right.edits - left.edits || left.path.localeCompare(right.path))
    .slice(0, 20);
  let feedbackMoments: SessionDigest['feedbackMoments'] = [];

  try {
    feedbackMoments = extractFeedbackMoments(lines);
  } catch {
    skippedLineCount += 1;
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
    commands,
    tools,
    skills,
    topFiles,
    feedbackMoments,
    outcome: deriveOutcome(allCommands),
  };

  return finalizeDigest(digest);
}

function digestByteLength(digest: unknown): number {
  return Buffer.byteLength(JSON.stringify(digest), 'utf8');
}

function trimArrayField<K extends keyof SessionDigest>(
  digest: SessionDigest,
  field: K,
): SessionDigest {
  const items = digest[field];
  if (!Array.isArray(items) || items.length === 0) {
    return digest;
  }

  return { ...digest, [field]: items.slice(0, items.length - 1) } as SessionDigest;
}

function shortenIntentTexts(digest: SessionDigest, nextLength: number): SessionDigest {
  return {
    ...digest,
    intents: digest.intents.map((intent) => ({
      ...intent,
      text: intent.text.slice(0, nextLength),
    })),
  };
}

function shortenCommands(digest: SessionDigest, nextLength: number): SessionDigest {
  return {
    ...digest,
    commands: digest.commands.map((command) => ({
      ...command,
      command: command.command.slice(0, nextLength),
    })),
  };
}

function shortenFeedbackMoments(digest: SessionDigest, delta: number): SessionDigest {
  return {
    ...digest,
    feedbackMoments: digest.feedbackMoments.map((moment) => ({
      ...moment,
      agentAction: moment.agentAction.slice(0, Math.max(40, moment.agentAction.length - delta)),
      userReaction: moment.userReaction.slice(0, Math.max(40, moment.userReaction.length - delta)),
      ...(moment.followupChange
        ? {
            followupChange: moment.followupChange.slice(
              0,
              Math.max(20, moment.followupChange.length - delta),
            ),
          }
        : {}),
    })),
  };
}

function truncateString(value: string, minLength: number, delta: number): string {
  if (value.length <= minLength) {
    return value;
  }

  return value.slice(0, Math.max(minLength, value.length - delta));
}

function truncateScalarFields(digest: SessionDigest, delta: number): SessionDigest {
  // Never truncate sessionId / workspaceRoot — they are identity keys used for
  // --workspace filtering (F1.5). Prefer dropping list payloads instead.
  return {
    ...digest,
    ...(digest.workspaceLabel !== undefined
      ? { workspaceLabel: truncateString(digest.workspaceLabel, MIN_SCALAR_TEXT_LENGTH, delta) }
      : {}),
    ...(digest.gitBranch !== undefined && digest.gitBranch !== null
      ? { gitBranch: truncateString(digest.gitBranch, MIN_SCALAR_TEXT_LENGTH, delta) }
      : {}),
    outcome: digest.outcome.evidence
      ? {
          signal: digest.outcome.signal,
          evidence: truncateString(digest.outcome.evidence, MIN_SCALAR_TEXT_LENGTH, delta),
        }
      : digest.outcome,
  };
}

function truncateArrayStringFields(digest: SessionDigest, delta: number): SessionDigest {
  return {
    ...digest,
    tools: digest.tools.map((tool) => ({
      ...tool,
      name: truncateString(tool.name, MIN_SCALAR_TEXT_LENGTH, delta),
    })),
    skills: digest.skills.map((skill) => ({
      ...skill,
      name: truncateString(skill.name, MIN_SCALAR_TEXT_LENGTH, delta),
    })),
    topFiles: digest.topFiles.map((file) => ({
      ...file,
      path: truncateString(file.path, MIN_SCALAR_TEXT_LENGTH, delta),
    })),
  };
}

function minimalUnknownDigest(turnCount = 0): SessionDigest {
  return {
    schemaVersion: 1,
    sessionId: 'unknown',
    workspaceRoot: '',
    startedAt: EPOCH_ISO,
    endedAt: EPOCH_ISO,
    turnCount,
    intents: [],
    commands: [],
    tools: [],
    skills: [],
    topFiles: [],
    feedbackMoments: [],
    outcome: { signal: 'unknown' },
  };
}

function enforceByteBudget(digest: SessionDigest): SessionDigest {
  let current = digest;
  if (digestByteLength(current) <= DIGEST_BYTE_BUDGET) {
    return current;
  }

  const arrayFields: Array<keyof SessionDigest> = [
    'feedbackMoments',
    'topFiles',
    'skills',
    'tools',
    'commands',
    'intents',
  ];

  for (let guard = 0; guard < 500 && digestByteLength(current) > DIGEST_BYTE_BUDGET; guard += 1) {
    let changed = false;

    for (const field of arrayFields) {
      if (digestByteLength(current) <= DIGEST_BYTE_BUDGET) {
        break;
      }

      const items = current[field];
      if (Array.isArray(items) && items.length > 0) {
        current = trimArrayField(current, field);
        changed = true;
      }
    }

    const maxIntentLength = current.intents.reduce((max, intent) => Math.max(max, intent.text.length), 0);
    if (digestByteLength(current) > DIGEST_BYTE_BUDGET && maxIntentLength > MIN_INTENT_TEXT_LENGTH) {
      current = shortenIntentTexts(current, Math.max(MIN_INTENT_TEXT_LENGTH, maxIntentLength - 20));
      changed = true;
    }

    const maxCommandLength = current.commands.reduce(
      (max, command) => Math.max(max, command.command.length),
      0,
    );
    if (digestByteLength(current) > DIGEST_BYTE_BUDGET && maxCommandLength > MIN_COMMAND_TEXT_LENGTH) {
      current = shortenCommands(current, Math.max(MIN_COMMAND_TEXT_LENGTH, maxCommandLength - 20));
      changed = true;
    }

    if (digestByteLength(current) > DIGEST_BYTE_BUDGET && current.feedbackMoments.length > 0) {
      current = shortenFeedbackMoments(current, 20);
      changed = true;
    }

    if (digestByteLength(current) > DIGEST_BYTE_BUDGET && current.outcome.evidence) {
      current = {
        ...current,
        outcome: {
          signal: current.outcome.signal,
          evidence: current.outcome.evidence.slice(0, Math.max(20, current.outcome.evidence.length - 20)),
        },
      };
      changed = true;
    }

    if (digestByteLength(current) > DIGEST_BYTE_BUDGET && current.workspaceLabel !== undefined) {
      const { workspaceLabel: _workspaceLabel, ...rest } = current;
      current = rest;
      changed = true;
    }

    if (digestByteLength(current) > DIGEST_BYTE_BUDGET && current.outcome.evidence !== undefined) {
      current = { ...current, outcome: { signal: current.outcome.signal } };
      changed = true;
    }

    if (digestByteLength(current) > DIGEST_BYTE_BUDGET) {
      current = truncateScalarFields(current, 20);
      changed = true;
    }

    if (digestByteLength(current) > DIGEST_BYTE_BUDGET) {
      current = truncateArrayStringFields(current, 20);
      changed = true;
    }

    if (!changed) {
      break;
    }
  }

  const parsed = SessionDigestSchema.safeParse(current);
  if (parsed.success) {
    return parsed.data;
  }

  return minimalUnknownDigest(current.turnCount);
}

function finalizeDigest(digest: unknown): SessionDigest {
  const parsed = SessionDigestSchema.safeParse(digest);
  if (parsed.success) {
    return enforceByteBudget(parsed.data);
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
    return enforceByteBudget(coerced.data);
  }

  return minimalUnknownDigest();
}
