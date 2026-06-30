import { DatabaseManager } from '../models/database';
import type { SecretStore } from './secret-store';

export function oauthClientSecretAccount(serviceId: string): string {
  return `oauth-client-secret:${serviceId}`;
}

/** OAuth app client secrets — Keychain/file store; SQLite holds Client ID only. */
export class OAuthClientSecretVault {
  constructor(
    private secretStore: SecretStore,
    private db: DatabaseManager,
  ) {}

  async get(serviceId: string, legacyPlaintext?: string | null): Promise<string | null> {
    const account = oauthClientSecretAccount(serviceId);
    const stored = await this.secretStore.get(account);
    if (stored) {
      return stored;
    }

    const legacy = legacyPlaintext?.trim();
    if (!legacy) {
      return null;
    }

    await this.secretStore.set(account, legacy);
    await this.db.updateService(serviceId, { oauthClientSecret: '' });
    return legacy;
  }

  async set(serviceId: string, secret: string): Promise<void> {
    await this.secretStore.set(oauthClientSecretAccount(serviceId), secret.trim());
    await this.db.updateService(serviceId, { oauthClientSecret: '' });
  }

  async has(serviceId: string, legacyPlaintext?: string | null): Promise<boolean> {
    if (legacyPlaintext?.trim()) {
      return true;
    }
    return this.secretStore.has(oauthClientSecretAccount(serviceId));
  }

  async delete(serviceId: string): Promise<void> {
    await this.secretStore.delete(oauthClientSecretAccount(serviceId));
    await this.db.updateService(serviceId, { oauthClientSecret: '' });
  }
}
