import type { FeedbackMoment } from '@agent-deck/shared';
import { summarizeAssistantAction, type AssistantActionSummary } from './extractors';
import { extractFeedbackMarkers } from './feedback-lexicon';
import { extractUserText, isRealUserIntent } from './real-intent';

const AGENT_ACTION_MAX_LENGTH = 400;
const USER_REACTION_MAX_LENGTH = 600;

type AssistantAction = {
  summary: AssistantActionSummary;
  index: number;
};

function isAssistantLine(line: unknown): boolean {
  return typeof line === 'object' && line !== null && (line as { type?: unknown }).type === 'assistant';
}

function timestampFor(line: unknown): string | undefined {
  const timestamp = typeof line === 'object' && line !== null ? (line as { timestamp?: unknown }).timestamp : undefined;
  return typeof timestamp === 'string' && !Number.isNaN(Date.parse(timestamp)) ? new Date(timestamp).toISOString() : undefined;
}

function truncate(value: string, maxLength: number): string {
  return value.slice(0, maxLength);
}

function nextReedit(lines: unknown[], startIndex: number, touchedPaths: string[]): AssistantActionSummary | undefined {
  if (touchedPaths.length === 0) {
    return undefined;
  }

  // F2.1: only the next tool-using assistant line counts; unrelated tools stop the scan.
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (!isAssistantLine(lines[index])) {
      continue;
    }

    const action = summarizeAssistantAction(lines[index]);
    if (action.toolNames.length === 0) {
      continue;
    }

    return action.filePaths.some((filePath) => touchedPaths.includes(filePath)) ? action : undefined;
  }

  return undefined;
}

export function extractFeedbackMoments(events: unknown[]): FeedbackMoment[] {
  const moments: FeedbackMoment[] = [];
  let precedingAction: AssistantAction | undefined;

  for (let index = 0; index < events.length && moments.length < 30; index += 1) {
    const event = events[index];

    if (isAssistantLine(event)) {
      const summary = summarizeAssistantAction(event);
      // Keep last tool action across prose-only assistant lines until the next tool_use.
      if (summary.toolNames.length > 0) {
        precedingAction = { summary, index };
      }
      continue;
    }

    if (!isRealUserIntent(event) || !precedingAction) {
      continue;
    }

    const userReaction = extractUserText(event);
    if (userReaction === null) {
      continue;
    }

    const { markers, polarityHint } = extractFeedbackMarkers(userReaction);
    const followup = nextReedit(events, index, precedingAction.summary.filePaths);
    if (markers.length === 0 && !followup) {
      continue;
    }

    moments.push({
      agentAction: truncate(precedingAction.summary.summary, AGENT_ACTION_MAX_LENGTH),
      userReaction: truncate(userReaction, USER_REACTION_MAX_LENGTH),
      polarityHint,
      markers,
      ...(followup ? { followupChange: truncate(followup.summary, AGENT_ACTION_MAX_LENGTH) } : {}),
      ...(timestampFor(event) ? { at: timestampFor(event) } : {}),
    });
  }

  return moments;
}
