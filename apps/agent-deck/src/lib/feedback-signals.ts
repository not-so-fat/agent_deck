import type { ApiResponse, FeedbackSignal, FeedbackSignalCount } from '@agent-deck/shared';
import { apiRequest } from '@/lib/queryClient';

async function parseApi<T>(res: Response): Promise<T> {
  const body = (await res.json()) as ApiResponse<T>;
  if (!body.success) {
    throw new Error(body.error ?? 'Request failed');
  }
  return body.data as T;
}

export async function getFeedbackSignalCount(playbookId?: string): Promise<number> {
  const qs = new URLSearchParams({ status: 'unreviewed' });
  if (playbookId) qs.set('playbookId', playbookId);
  const res = await apiRequest('GET', `/api/feedback-signals/count?${qs.toString()}`);
  const data = await parseApi<FeedbackSignalCount>(res);
  return data.unreviewed;
}

export async function listFeedbackSignals(filters?: {
  status?: string;
  playbookId?: string;
  deckId?: string;
}): Promise<FeedbackSignal[]> {
  const qs = new URLSearchParams();
  if (filters?.status) qs.set('status', filters.status);
  if (filters?.playbookId) qs.set('playbookId', filters.playbookId);
  if (filters?.deckId) qs.set('deckId', filters.deckId);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await apiRequest('GET', `/api/feedback-signals${suffix}`);
  return parseApi<FeedbackSignal[]>(res);
}

export async function discardFeedbackSignals(signalIds: string[]): Promise<{
  discarded: number;
  ids: string[];
}> {
  const res = await apiRequest('POST', '/api/feedback-signals/discard', { signalIds });
  return parseApi(res);
}

/** Prompt + signal JSON for pasting into an IDE agent chat to curate. */
export function buildCurationPromptForAgent(signals: FeedbackSignal[]): string {
  const compact = signals.map((s) => ({
    id: s.id,
    candidatePlaybookId: s.candidatePlaybookId,
    candidateDeckId: s.candidateDeckId,
    failureSummary: s.failureSummary,
    userFeedbackExcerpt: s.userFeedbackExcerpt,
    correctedOutputHint: s.correctedOutputHint,
  }));
  return `Curate these Agent Deck feedback signals (from the dashboard backlog).

For each coherent pattern: call propose_playbook_patch with consolidated item ops (prefer add_item) — or kind "create" for genesis clusters with no candidatePlaybookId — and pass signal_ids of the rows you consumed. That curation submit must not invent a new signal row. Discard noise is done in the dashboard — tell me which ids to discard if any are junk.

Signals:
\`\`\`json
${JSON.stringify(compact, null, 2)}
\`\`\``;
}
