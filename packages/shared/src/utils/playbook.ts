export function slugifyPlaybookTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .slice(0, 48);
}

export function derivePlaybookIdFromTitle(title: string): string {
  const slug = slugifyPlaybookTitle(title);
  return `pb_${slug || 'playbook'}`;
}

export type PlaybookDefaults = {
  id: string;
  title: string;
};

export function derivePlaybookDefaults(
  title: string,
  overrides?: Partial<PlaybookDefaults>,
): PlaybookDefaults {
  const trimmed = title.trim();
  return {
    title: trimmed,
    id: overrides?.id ?? derivePlaybookIdFromTitle(trimmed),
  };
}
