import { DatabaseManager } from './models/database';
import { resolveDatabasePath } from './lib/paths';
import { createSecretStore, CredentialManager } from './vault';
import { PlaybookDependencyError, PlaybookManager } from './playbooks/playbook-manager';

/** Shared credential manager for the agent-deck CLI (vault + exec). */
export function createCliCredentialManager(): CredentialManager {
  const db = new DatabaseManager(resolveDatabasePath());
  return new CredentialManager(db, createSecretStore());
}

/**
 * Rare collection/deck ops for the CLI (not MCP).
 * Delete service/playbook/deck — same dependency checks as the dashboard API.
 */
export function createCliCollectionAdmin() {
  const db = new DatabaseManager(resolveDatabasePath());
  const playbooks = new PlaybookManager(db);

  return {
    async deleteService(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
      const service = await db.getService(id);
      if (!service) {
        return { ok: false, error: `Service not found: ${id}` };
      }

      const dependents = await db.getPlaybooksDependingOnService(id);
      if (dependents.length > 0) {
        const titles = dependents.map((playbook) => playbook.title).join(', ');
        return {
          ok: false,
          error: `Cannot delete MCP "${service.name}": referenced by playbook(s): ${titles}`,
        };
      }

      const deleted = await db.deleteService(id);
      if (!deleted) {
        return { ok: false, error: `Service not found: ${id}` };
      }
      return { ok: true };
    },

    async deletePlaybook(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
      const deleted = await playbooks.delete(id);
      if (!deleted) {
        return { ok: false, error: `Playbook not found: ${id}` };
      }
      return { ok: true };
    },

    async deleteDeck(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
      const deck = await db.getDeck(id);
      if (!deck) {
        return { ok: false, error: `Deck not found: ${id}` };
      }
      const deleted = await db.deleteDeck(id);
      if (!deleted) {
        return { ok: false, error: `Deck not found: ${id}` };
      }
      return { ok: true };
    },

    async listServices(): Promise<Array<{ id: string; name: string; type: string }>> {
      const services = await db.getAllServices();
      return services.map((service) => ({
        id: service.id,
        name: service.name,
        type: service.type,
      }));
    },

    async listPlaybooks(): Promise<Array<{ id: string; title: string }>> {
      const items = await playbooks.list();
      return items.map((playbook) => ({ id: playbook.id, title: playbook.title }));
    },

    async listDecks(): Promise<Array<{ id: string; name: string }>> {
      const decks = await db.getAllDecks();
      return decks.map((deck) => ({ id: deck.id, name: deck.name }));
    },
  };
}

export type CliCollectionAdmin = ReturnType<typeof createCliCollectionAdmin>;

export { PlaybookDependencyError };
