type TranscriptLine = {
  type?: unknown;
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
  const text = extractUserText(transcriptLine);
  return (
    transcriptLine.type === 'user' &&
    transcriptLine.isSidechain !== true &&
    !Object.prototype.hasOwnProperty.call(transcriptLine, 'toolUseResult') &&
    text !== null &&
    text.trim().length > 0
  );
}
