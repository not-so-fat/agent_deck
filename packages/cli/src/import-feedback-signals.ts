import fs from 'node:fs';
import path from 'node:path';
import { AGENT_DECK_CLIENT_HEADER, AGENT_DECK_DASHBOARD_CLIENT } from '@agent-deck/shared';

type ParsedSignal = {
  source: 'backfill';
  sourceRef: string;
  failureSummary: string;
  userFeedbackExcerpt: string;
  correctedOutputHint?: string | null;
  candidatePlaybookId?: string | null;
  candidateDeckId?: string | null;
};

/** Heuristic: user turns that look like corrections (short + imperative / negative cues). */
const CORRECTION_CUES =
  /\b(fix|don't|do not|instead|should|never|always|wrong|missed|actually|just note|prefer)\b/i;

function printUsage(): void {
  console.log(`Usage:
  agent-deck import-feedback-signals <transcript-dir> [--backend-url URL] [--output <path>]

Parse Claude Code JSONL transcripts for correction-like user turns.
With --backend-url, POSTs to /api/feedback-signals/import.
Otherwise writes a JSON file (default: ./feedback-signals-import.json).`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractUserText(line: Record<string, unknown>): string | null {
  // Common Claude Code JSONL shapes
  if (typeof line.message === 'string' && line.role === 'user') return line.message;
  if (isRecord(line.message)) {
    const role = line.message.role;
    const content = line.message.content;
    if (role === 'user' && typeof content === 'string') return content;
    if (role === 'user' && Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === 'string') return part;
          if (isRecord(part) && typeof part.text === 'string') return part.text;
          return '';
        })
        .filter(Boolean)
        .join('\n');
    }
  }
  if (line.type === 'user' && typeof line.text === 'string') return line.text;
  return null;
}

export function parseTranscriptFile(filePath: string): ParsedSignal[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const signals: ParsedSignal[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i].trim();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!isRecord(parsed)) continue;
    const text = extractUserText(parsed);
    if (!text) continue;
    const trimmed = text.trim();
    if (trimmed.length < 8 || trimmed.length > 500) continue;
    if (!CORRECTION_CUES.test(trimmed)) continue;
    signals.push({
      source: 'backfill',
      sourceRef: `transcript:${path.basename(filePath)}#L${i + 1}`,
      failureSummary: `Historical correction from ${path.basename(filePath)}`,
      userFeedbackExcerpt: trimmed.slice(0, 280),
      correctedOutputHint: null,
      candidatePlaybookId: null,
      candidateDeckId: null,
    });
  }
  return signals;
}

export function collectSignalsFromDir(dir: string): ParsedSignal[] {
  const abs = path.resolve(dir);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    throw new Error(`Not a directory: ${abs}`);
  }
  const entries = fs.readdirSync(abs);
  const signals: ParsedSignal[] = [];
  for (const name of entries) {
    if (!name.endsWith('.jsonl')) continue;
    signals.push(...parseTranscriptFile(path.join(abs, name)));
  }
  return signals;
}

export async function runImportFeedbackSignalsCommand(args: string[]): Promise<number> {
  if (!args[0] || args[0] === '--help' || args[0] === '-h') {
    printUsage();
    return args[0] ? 0 : 1;
  }

  const dir = args[0];
  let backendUrl: string | undefined;
  let output = path.resolve('feedback-signals-import.json');

  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--backend-url') {
      backendUrl = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      output = path.resolve(args[++i] ?? output);
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      return 0;
    } else {
      console.error(`Unknown argument: ${arg}`);
      printUsage();
      return 1;
    }
  }

  let signals: ParsedSignal[];
  try {
    signals = collectSignalsFromDir(dir);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    return 1;
  }

  console.log(`Parsed ${signals.length} correction-like turn(s) from ${path.resolve(dir)}`);

  if (signals.length === 0) {
    return 0;
  }

  if (backendUrl) {
    const url = `${backendUrl.replace(/\/$/, '')}/api/feedback-signals/import`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [AGENT_DECK_CLIENT_HEADER]: AGENT_DECK_DASHBOARD_CLIENT,
      },
      body: JSON.stringify({ signals }),
    });
    const body = (await res.json()) as {
      success?: boolean;
      error?: string;
      data?: { inserted: number; errors: unknown[] };
    };
    if (!res.ok || !body.success) {
      console.error(body.error ?? `Import failed: HTTP ${res.status}`);
      return 1;
    }
    console.log(
      `Imported ${body.data?.inserted ?? 0} signal(s); ${body.data?.errors?.length ?? 0} error(s)`,
    );
    return 0;
  }

  fs.writeFileSync(output, JSON.stringify({ signals }, null, 2), 'utf8');
  console.log(`Wrote ${signals.length} signal(s) to ${output}`);
  console.log(`Later: POST to /api/feedback-signals/import or re-run with --backend-url`);
  return 0;
}
