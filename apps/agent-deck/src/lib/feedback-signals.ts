import type { ApiResponse, FeedbackSignal, FeedbackSignalCount } from '@agent-deck/shared';
import { apiRequest } from '@/lib/queryClient';

async function parseApi<T>(res: Response): Promise<T> {
  const body = (await res.json()) as ApiResponse<T>;
  if (!body.success) {
    throw new Error(body.error ?? 'Request failed');
  }
  return body.data as T;
}

/** Available-open count for badges (excludes rows already in a proposed patch). */
export async function getFeedbackSignalCount(playbookId?: string): Promise<number> {
  const qs = new URLSearchParams({ available: '1' });
  if (playbookId) qs.set('playbookId', playbookId);
  const res = await apiRequest('GET', `/api/feedback-signals/count?${qs.toString()}`);
  const data = await parseApi<FeedbackSignalCount>(res);
  return data.open;
}

export async function listFeedbackSignals(filters?: {
  status?: string;
  playbookId?: string;
  deckId?: string;
  excludeInProposal?: boolean;
}): Promise<FeedbackSignal[]> {
  const qs = new URLSearchParams();
  if (filters?.status) qs.set('status', filters.status);
  if (filters?.playbookId) qs.set('playbookId', filters.playbookId);
  if (filters?.deckId) qs.set('deckId', filters.deckId);
  if (filters?.excludeInProposal !== undefined) {
    qs.set('excludeInProposal', filters.excludeInProposal ? 'true' : 'false');
  }
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

/** Whether the signal is parked by an open proposal (client-side when patch status known). */
export function signalLooksInProposal(signal: FeedbackSignal): boolean {
  return Boolean(signal.linkedPatchId) && signal.status === 'open';
}

/** YAML double-quoted scalar (safe for feedback excerpts with quotes/newlines). */
function yamlQuoted(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

function yamlNullOrQuoted(value: string | null | undefined): string {
  if (value == null || value === '') return 'null';
  return yamlQuoted(value);
}

/** Markdown instructions + YAML signal list (ids first) for IDE agent paste. */
export function buildCurationPromptForAgent(signals: FeedbackSignal[]): string {
  const yamlItems = signals
    .map((s) => {
      const lines = [
        `- id: ${s.id}`,
        `  playbook: ${yamlNullOrQuoted(s.candidatePlaybookId)}`,
        `  feedback: ${yamlQuoted(s.userFeedbackExcerpt)}`,
        `  failure: ${yamlQuoted(s.failureSummary)}`,
      ];
      if (s.correctedOutputHint) {
        lines.push(`  hint: ${yamlQuoted(s.correctedOutputHint)}`);
      }
      if (s.candidateDeckId) {
        lines.push(`  deck: ${s.candidateDeckId}`);
      }
      return lines.join('\n');
    })
    .join('\n');

  return `Propose playbook updates from these Agent Deck feedback signals (copied from the Feedback table).

For each coherent pattern:
1. Call \`propose_playbook_patch\` with consolidated item ops (prefer \`add_item\`) — or kind \`create\` when there is no playbook.
2. Pass **every** consumed row \`id\` in \`signal_ids\` so we can track which feedback is parked / solved.
3. Do not invent a list-feedback MCP tool. Discard noise in the dashboard.

Signals (\`id\` required for tracking):

\`\`\`yaml
${yamlItems}
\`\`\``;
}
