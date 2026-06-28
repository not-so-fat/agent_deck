export function slugifyCredentialLabel(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

  return slug || 'connection';
}

export function deriveEnvNameFromLabel(label: string): string {
  let slug = slugifyCredentialLabel(label).toUpperCase();
  if (slug.endsWith('_API_KEY')) {
    return slug;
  }
  if (slug.endsWith('_API')) {
    slug = slug.slice(0, -4);
  }
  return `${slug}_API_KEY`;
}

export function deriveCredentialIdFromLabel(label: string): string {
  return `cred_${slugifyCredentialLabel(label)}`;
}

export type CredentialDefaults = {
  id: string;
  label: string;
  scheme: 'bearer' | 'header' | 'http_basic_user';
  envName: string;
  tags: string[];
};

export function deriveCredentialDefaults(
  label: string,
  overrides?: Partial<CredentialDefaults>,
): CredentialDefaults {
  const trimmed = label.trim();
  return {
    id: overrides?.id ?? deriveCredentialIdFromLabel(trimmed),
    label: trimmed,
    scheme: overrides?.scheme ?? 'bearer',
    envName: overrides?.envName ?? deriveEnvNameFromLabel(trimmed),
    tags: overrides?.tags ?? [],
  };
}
