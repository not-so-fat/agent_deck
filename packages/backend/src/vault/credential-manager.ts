import {
  AddCredentialToDeckInput,
  CreateCredentialInput,
  Credential,
  RemoveCredentialFromDeckInput,
  RotateCredentialInput,
  UpdateCredentialInput,
} from '@agent-deck/shared';
import { DatabaseManager } from '../models/database';
import { CredentialYamlSync } from './yaml-sync';
import { SecretStore, VaultUnsupportedError } from './secret-store';

export class CredentialManager {
  constructor(
    private db: DatabaseManager,
    private secretStore: SecretStore,
    private yamlSync: CredentialYamlSync = new CredentialYamlSync(),
  ) {}

  async create(input: CreateCredentialInput): Promise<Credential> {
    const keychainAccount = input.keychainAccount ?? input.id;
    await this.secretStore.set(keychainAccount, input.value);

    const credential = await this.db.createCredential({
      id: input.id,
      label: input.label,
      scheme: input.scheme,
      headerName: input.headerName,
      envName: input.envName,
      keychainAccount,
      tags: input.tags ?? [],
      hasSecret: true,
    });

    await this.yamlSync.write(credential);
    return credential;
  }

  async list(): Promise<Credential[]> {
    const credentials = await this.db.getAllCredentials();
    return Promise.all(
      credentials.map(async (credential) => ({
        ...credential,
        hasSecret: await this.secretStore.has(credential.keychainAccount),
      })),
    );
  }

  async listForDeck(deckId: string): Promise<Credential[]> {
    const credentials = await this.db.getDeckCredentialsForDeck(deckId);
    return Promise.all(
      credentials.map(async (credential) => ({
        ...credential,
        hasSecret: await this.secretStore.has(credential.keychainAccount),
      })),
    );
  }

  async listForActiveDeck(): Promise<Credential[]> {
    const activeDeck = await this.db.getActiveDeck();
    if (!activeDeck) {
      return [];
    }
    return this.listForDeck(activeDeck.id);
  }

  async isCredentialOnDeck(deckId: string, credentialId: string): Promise<boolean> {
    const credentials = await this.db.getDeckCredentialsForDeck(deckId);
    return credentials.some((credential) => credential.id === credentialId);
  }

  async assertCredentialsOnDeck(deckId: string, credentialIds: string[]): Promise<void> {
    const credentials = await this.db.getDeckCredentialsForDeck(deckId);
    const allowed = new Set(credentials.map((credential) => credential.id));

    for (const credentialId of credentialIds) {
      if (!allowed.has(credentialId)) {
        throw new Error(`Credential ${credentialId} is not on deck ${deckId}`);
      }
    }
  }

  async getIfOnActiveDeck(id: string): Promise<Credential | null> {
    const activeDeck = await this.db.getActiveDeck();
    if (!activeDeck) {
      return null;
    }

    const onDeck = await this.isCredentialOnDeck(activeDeck.id, id);
    if (!onDeck) {
      return null;
    }

    return this.get(id);
  }

  async get(id: string): Promise<Credential | null> {
    const credential = await this.db.getCredential(id);
    if (!credential) {
      return null;
    }

    return {
      ...credential,
      hasSecret: await this.secretStore.has(credential.keychainAccount),
    };
  }

  async update(id: string, input: UpdateCredentialInput): Promise<Credential | null> {
    const updated = await this.db.updateCredential(id, input);
    if (!updated) {
      return null;
    }

    const credential = {
      ...updated,
      hasSecret: await this.secretStore.has(updated.keychainAccount),
    };

    await this.yamlSync.write(credential);
    return credential;
  }

  async rotate(id: string, input: RotateCredentialInput): Promise<Credential | null> {
    const existing = await this.db.getCredential(id);
    if (!existing) {
      return null;
    }

    await this.secretStore.set(existing.keychainAccount, input.value);

    const credential = {
      ...existing,
      updatedAt: new Date().toISOString(),
      hasSecret: true,
    };

    await this.db.touchCredential(id);
    await this.yamlSync.write(credential);
    return credential;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.db.getCredential(id);
    if (!existing) {
      return false;
    }

    const dependents = await this.db.getPlaybooksDependingOnCredential(id);
    if (dependents.length > 0) {
      const { PlaybookDependencyError } = await import('../playbooks/playbook-manager');
      throw new PlaybookDependencyError(
        `Cannot delete API key "${existing.label}": referenced by playbook(s): ${dependents.map((p) => p.title).join(', ')}`,
        dependents.map(({ id: playbookId, title }) => ({ id: playbookId, title })),
      );
    }

    try {
      await this.secretStore.delete(existing.keychainAccount);
    } catch (error) {
      if (!(error instanceof VaultUnsupportedError)) {
        throw error;
      }
    }

    const deleted = await this.db.deleteCredential(id);
    if (deleted) {
      await this.yamlSync.remove(id);
    }
    return deleted;
  }

  async resolveEnvMap(credentialIds: string[]): Promise<Record<string, string>> {
    const env: Record<string, string> = {};

    for (const credentialId of credentialIds) {
      const credential = await this.db.getCredential(credentialId);
      if (!credential) {
        throw new Error(`Credential not found: ${credentialId}`);
      }

      const secret = await this.secretStore.get(credential.keychainAccount);
      if (!secret) {
        throw new Error(`Secret not found in vault for credential: ${credentialId}`);
      }

      env[credential.envName] = secret;
    }

    return env;
  }

  async addToDeck(input: AddCredentialToDeckInput): Promise<void> {
    const credential = await this.db.getCredential(input.credentialId);
    if (!credential) {
      throw new Error(`Credential not found: ${input.credentialId}`);
    }

    await this.db.addCredentialToDeck(input);
  }

  async removeFromDeck(input: RemoveCredentialFromDeckInput): Promise<void> {
    await this.db.removeCredentialFromDeck(input);
  }

  async recordExecRun(input: {
    deckId?: string;
    manifestPath?: string;
    command: string;
    credentialIds: string[];
    exitCode?: number;
    startedAt: string;
    finishedAt?: string;
  }) {
    return this.db.createExecRun(input);
  }
}
