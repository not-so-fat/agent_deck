const SUMMARY_MAX = 180;

export function stripMarkdownInline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function toolDescriptionSummary(description: string, title?: string): string {
  if (title?.trim()) {
    return title.trim();
  }

  const firstBlock = description.split(/\n\n+/)[0]?.replace(/\n/g, " ") ?? description;
  const plain = stripMarkdownInline(firstBlock);
  if (plain.length <= SUMMARY_MAX) {
    return plain;
  }
  return `${plain.slice(0, SUMMARY_MAX - 1).trimEnd()}…`;
}

export function isLongToolDescription(description: string, title?: string): boolean {
  if (title?.trim() && description.length > SUMMARY_MAX) {
    return true;
  }
  return description.length > SUMMARY_MAX || /\n/.test(description);
}
