type TranscriptLine = {
  type?: unknown;
  role?: unknown;
  isSidechain?: unknown;
  toolUseResult?: unknown;
  message?: {
    role?: unknown;
    content?: unknown;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function extractUserText(line: unknown): string | null {
  if (!isRecord(line) || !isRecord(line.message)) {
    return null;
  }

  const { content } = line.message;
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content) || content.some((block) => !isRecord(block) || block.type !== 'text' || typeof block.text !== 'string')) {
    return null;
  }

  return content.map((block) => (block as { text: string }).text).join('\n');
}

export function isRealUserIntent(line: unknown): boolean {
  if (!isRecord(line)) {
    return false;
  }

  const transcriptLine = line as TranscriptLine;
  if (transcriptLine.isSidechain === true) {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(transcriptLine, 'toolUseResult')) {
    return false;
  }

  const text = extractUserText(transcriptLine);
  if (text === null || text.trim().length === 0) {
    return false;
  }

  const messageRole = isRecord(transcriptLine.message) ? transcriptLine.message.role : undefined;
  const isUser =
    transcriptLine.type === 'user' ||
    transcriptLine.role === 'user' ||
    messageRole === 'user';
  if (!isUser) {
    return false;
  }

  // Cursor control lines (turn_ended, etc.) must not count even if they carry a message blob.
  if (
    typeof transcriptLine.type === 'string' &&
    transcriptLine.type !== 'user' &&
    transcriptLine.type !== 'assistant' &&
    transcriptLine.role !== 'user'
  ) {
    return false;
  }

  return true;
}
