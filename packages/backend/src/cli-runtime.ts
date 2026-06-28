import { DatabaseManager } from './models/database';
import { resolveDatabasePath } from './lib/paths';
import { createSecretStore, CredentialManager } from './vault';

/** Shared credential manager for the agent-deck CLI (vault + exec). */
export function createCliCredentialManager(): CredentialManager {
  const db = new DatabaseManager(resolveDatabasePath());
  return new CredentialManager(db, createSecretStore());
}
