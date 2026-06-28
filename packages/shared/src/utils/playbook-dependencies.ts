export type PlaybookDependencyCatalog = {
  credentials: Array<{ id: string; label: string; envName: string }>;
  services: Array<{ id: string; name: string }>;
};

export type PlaybookDependencyText = {
  title?: string;
  body?: string;
  exec?: string;
  skill?: string;
  triggers?: string[];
};

const CREDENTIAL_ID_PATTERN = /\bcred_[a-z0-9_]+\b/g;
const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const CONNECTIONS_FLAG_PATTERN = /--connections(?:=|\s+)([^\s]+)/g;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesWholeWord(text: string, word: string): boolean {
  const trimmed = word.trim();
  if (!trimmed) {
    return false;
  }
  return new RegExp(`\\b${escapeRegex(trimmed)}\\b`, 'i').test(text);
}

export function buildPlaybookSearchText(parts: PlaybookDependencyText): string {
  return [
    parts.title ?? '',
    parts.body ?? '',
    parts.exec ?? '',
    parts.skill ?? '',
    ...(parts.triggers ?? []),
  ].join('\n');
}

export function detectPlaybookDependencies(
  text: string,
  catalog: PlaybookDependencyCatalog,
  explicit: { credentialIds?: string[]; serviceIds?: string[] } = {},
): { dependsOnCredentialIds: string[]; dependsOnServiceIds: string[] } {
  const credentialIds = new Set<string>(explicit.credentialIds ?? []);
  const serviceIds = new Set<string>(explicit.serviceIds ?? []);
  const knownCredentialIds = new Set(catalog.credentials.map((item) => item.id));
  const servicesById = new Map(
    catalog.services.map((service) => [service.id.toLowerCase(), service.id]),
  );

  for (const match of text.matchAll(CREDENTIAL_ID_PATTERN)) {
    const id = match[0];
    if (knownCredentialIds.has(id)) {
      credentialIds.add(id);
    }
  }

  for (const match of text.matchAll(CONNECTIONS_FLAG_PATTERN)) {
    for (const token of match[1].split(',')) {
      const id = token.trim();
      if (knownCredentialIds.has(id)) {
        credentialIds.add(id);
      }
    }
  }

  for (const credential of catalog.credentials) {
    if (credential.envName && text.includes(credential.envName)) {
      credentialIds.add(credential.id);
    }
    if (matchesWholeWord(text, credential.label)) {
      credentialIds.add(credential.id);
    }
  }

  for (const match of text.matchAll(UUID_PATTERN)) {
    const resolved = servicesById.get(match[0].toLowerCase());
    if (resolved) {
      serviceIds.add(resolved);
    }
  }

  for (const service of catalog.services) {
    if (matchesWholeWord(text, service.name)) {
      serviceIds.add(service.id);
    }
  }

  return {
    dependsOnCredentialIds: [...credentialIds].sort(),
    dependsOnServiceIds: [...serviceIds].sort(),
  };
}
