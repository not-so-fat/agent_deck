import type { Credential } from '../schemas/credential';
import type { Playbook } from '../schemas/playbook';
import type { Service } from '../schemas/service';

export type CollectionCardKind = 'service' | 'credential' | 'playbook';

export type CollectionWarningKind =
  | 'oauth_required'
  | 'oauth_expired'
  | 'service_unhealthy'
  | 'credential_missing_secret'
  | 'playbook_missing_deps';

export type CollectionCardWarning = {
  kind: CollectionWarningKind;
  message: string;
  severity: 'warning' | 'error';
};

export type CollectionCatalog = {
  credentialIds: Set<string>;
  serviceIds: Set<string>;
};

const OAUTH_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export function isOAuthTokenExpiringSoon(expiresAt?: string): boolean {
  if (!expiresAt) {
    return false;
  }
  return new Date(expiresAt).getTime() <= Date.now() + OAUTH_EXPIRY_BUFFER_MS;
}

export function getServiceWarnings(service: Service): CollectionCardWarning[] {
  const warnings: CollectionCardWarning[] = [];

  if (service.health === 'unhealthy') {
    warnings.push({
      kind: 'service_unhealthy',
      message: 'Service reported unhealthy',
      severity: 'warning',
    });
  }

  if (service.type !== 'mcp' || !service.oauthClientId) {
    return warnings;
  }

  const hasToken = Boolean(service.oauthAccessToken);
  const hasAuthHeader = Boolean(service.headers?.Authorization);

  if (!hasToken || !hasAuthHeader) {
    warnings.push({
      kind: 'oauth_required',
      message: 'OAuth authentication required',
      severity: 'error',
    });
    return warnings;
  }

  if (isOAuthTokenExpiringSoon(service.oauthTokenExpiresAt)) {
    warnings.push({
      kind: 'oauth_expired',
      message: 'OAuth token expired — re-authenticate',
      severity: 'error',
    });
  }

  return warnings;
}

export function getCredentialWarnings(credential: Credential): CollectionCardWarning[] {
  if (credential.hasSecret) {
    return [];
  }

  return [
    {
      kind: 'credential_missing_secret',
      message: 'API key value not stored in Keychain',
      severity: 'error',
    },
  ];
}

export function getPlaybookWarnings(
  playbook: Playbook,
  catalog: CollectionCatalog,
): CollectionCardWarning[] {
  const missingCredentials = playbook.dependsOnCredentialIds.filter(
    (id) => !catalog.credentialIds.has(id),
  );
  const missingServices = playbook.dependsOnServiceIds.filter((id) => !catalog.serviceIds.has(id));
  const missingCount = missingCredentials.length + missingServices.length;

  if (missingCount === 0) {
    return [];
  }

  return [
    {
      kind: 'playbook_missing_deps',
      message: `${missingCount} missing dependency reference${missingCount === 1 ? '' : 's'}`,
      severity: 'warning',
    },
  ];
}

export function buildCollectionCatalog(
  credentials: Credential[],
  services: Service[],
): CollectionCatalog {
  return {
    credentialIds: new Set(credentials.map((item) => item.id)),
    serviceIds: new Set(services.map((item) => item.id)),
  };
}

export function summarizeCollectionWarnings(
  services: Service[],
  credentials: Credential[],
  playbooks: Playbook[],
): {
  total: number;
  byKind: Record<CollectionWarningKind, number>;
  serviceWarnings: Map<string, CollectionCardWarning[]>;
  credentialWarnings: Map<string, CollectionCardWarning[]>;
  playbookWarnings: Map<string, CollectionCardWarning[]>;
} {
  const catalog = buildCollectionCatalog(credentials, services);
  const serviceWarnings = new Map<string, CollectionCardWarning[]>();
  const credentialWarnings = new Map<string, CollectionCardWarning[]>();
  const playbookWarnings = new Map<string, CollectionCardWarning[]>();
  const byKind = {
    oauth_required: 0,
    oauth_expired: 0,
    service_unhealthy: 0,
    credential_missing_secret: 0,
    playbook_missing_deps: 0,
  } satisfies Record<CollectionWarningKind, number>;

  for (const service of services) {
    const warnings = getServiceWarnings(service);
    if (warnings.length > 0) {
      serviceWarnings.set(service.id, warnings);
      for (const warning of warnings) {
        byKind[warning.kind] += 1;
      }
    }
  }

  for (const credential of credentials) {
    const warnings = getCredentialWarnings(credential);
    if (warnings.length > 0) {
      credentialWarnings.set(credential.id, warnings);
      for (const warning of warnings) {
        byKind[warning.kind] += 1;
      }
    }
  }

  for (const playbook of playbooks) {
    const warnings = getPlaybookWarnings(playbook, catalog);
    if (warnings.length > 0) {
      playbookWarnings.set(playbook.id, warnings);
      for (const warning of warnings) {
        byKind[warning.kind] += 1;
      }
    }
  }

  return {
    total: serviceWarnings.size + credentialWarnings.size + playbookWarnings.size,
    byKind,
    serviceWarnings,
    credentialWarnings,
    playbookWarnings,
  };
}

export function primaryCollectionWarning(
  warnings: CollectionCardWarning[] | undefined,
): CollectionCardWarning | undefined {
  if (!warnings?.length) {
    return undefined;
  }
  return warnings.find((warning) => warning.severity === 'error') ?? warnings[0];
}
