import {
  AddPlaybookToDeckInput,
  AgentRegisterPlaybookInput,
  AgentUpdatePlaybookInput,
  CreatePlaybookInput,
  CreatePlaybookSchema,
  derivePlaybookDefaults,
  Playbook,
  PlaybookDependencies,
  PlaybookDependent,
  PlaybookSummary,
  PlaybookWithDependencies,
  RemovePlaybookFromDeckInput,
  UpdatePlaybookInput,
  UpdatePlaybookSchema,
  buildPlaybookSearchText,
  detectPlaybookDependencies,
  type PlaybookDependencyCatalog,
} from '@agent-deck/shared';
import { DatabaseManager } from '../models/database';

export class PlaybookDependencyError extends Error {
  constructor(
    message: string,
    public dependents: PlaybookDependent[],
  ) {
    super(message);
    this.name = 'PlaybookDependencyError';
  }
}

export class PlaybookManager {
  constructor(private db: DatabaseManager) {}

  async create(input: CreatePlaybookInput): Promise<Playbook> {
    const defaults = derivePlaybookDefaults(input.title, input.id ? { id: input.id } : undefined);
    const validated = CreatePlaybookSchema.parse(input);
    const playbookId = validated.id ?? defaults.id;

    const existing = await this.db.getAllPlaybooks();
    if (existing.some((playbook) => playbook.id === playbookId)) {
      throw new Error(`Playbook with id "${playbookId}" already exists`);
    }
    if (existing.some((playbook) => playbook.title === validated.title)) {
      throw new Error(`Playbook with title "${validated.title}" already exists`);
    }

    return this.db.createPlaybook({
      ...validated,
      id: playbookId,
    });
  }

  async buildDependencyCatalog(): Promise<PlaybookDependencyCatalog> {
    const [credentials, services] = await Promise.all([
      this.db.getAllCredentials(),
      this.db.getAllServices(),
    ]);

    return {
      credentials: credentials.map((credential) => ({
        id: credential.id,
        label: credential.label,
        envName: credential.envName,
      })),
      services: services.map((service) => ({
        id: service.id,
        name: service.name,
      })),
    };
  }

  async createWithDependencies(
    input: AgentRegisterPlaybookInput,
  ): Promise<PlaybookWithDependencies> {
    const { addToBoundDeck: _addToBoundDeck, autoDetectDependencies, ...createInput } = input;
    const catalog = await this.buildDependencyCatalog();
    const dependencies = autoDetectDependencies
      ? detectPlaybookDependencies(buildPlaybookSearchText(createInput), catalog, {
          credentialIds: createInput.dependsOnCredentialIds,
          serviceIds: createInput.dependsOnServiceIds,
        })
      : {
          dependsOnCredentialIds: createInput.dependsOnCredentialIds ?? [],
          dependsOnServiceIds: createInput.dependsOnServiceIds ?? [],
        };

    const playbook = await this.create({
      ...createInput,
      ...dependencies,
    });

    const withDependencies = await this.getWithDependencies(playbook.id);
    if (!withDependencies) {
      throw new Error(`Playbook not found after create: ${playbook.id}`);
    }

    return withDependencies;
  }

  async updateWithDependencies(
    id: string,
    input: AgentUpdatePlaybookInput,
  ): Promise<PlaybookWithDependencies | null> {
    const existing = await this.get(id);
    if (!existing) {
      return null;
    }

    const { autoDetectDependencies, ...updateInput } = input;
    const merged = {
      title: updateInput.title ?? existing.title,
      body: updateInput.body ?? existing.body,
      exec: updateInput.exec ?? existing.exec,
      skill: updateInput.skill ?? existing.skill,
      triggers: updateInput.triggers ?? existing.triggers,
      dependsOnCredentialIds:
        updateInput.dependsOnCredentialIds ?? existing.dependsOnCredentialIds,
      dependsOnServiceIds: updateInput.dependsOnServiceIds ?? existing.dependsOnServiceIds,
    };

    const dependencies = autoDetectDependencies
      ? detectPlaybookDependencies(
          buildPlaybookSearchText(merged),
          await this.buildDependencyCatalog(),
          {
            credentialIds: updateInput.dependsOnCredentialIds,
            serviceIds: updateInput.dependsOnServiceIds,
          },
        )
      : {
          dependsOnCredentialIds: merged.dependsOnCredentialIds,
          dependsOnServiceIds: merged.dependsOnServiceIds,
        };

    const updated = await this.update(id, {
      ...updateInput,
      ...dependencies,
    });

    if (!updated) {
      return null;
    }

    return this.getWithDependencies(id);
  }

  async list(): Promise<Playbook[]> {
    return this.db.getAllPlaybooks();
  }

  async listForDeck(deckId: string): Promise<Playbook[]> {
    return this.db.getDeckPlaybooksForDeck(deckId);
  }

  async listSummariesForDeck(deckId: string): Promise<PlaybookSummary[]> {
    const playbooks = await this.listForDeck(deckId);
    return playbooks.map(({ id, title, triggers }) => ({ id, title, triggers }));
  }

  async isPlaybookOnDeck(deckId: string, playbookId: string): Promise<boolean> {
    const playbooks = await this.db.getDeckPlaybooksForDeck(deckId);
    return playbooks.some((playbook) => playbook.id === playbookId);
  }

  async get(id: string): Promise<Playbook | null> {
    return this.db.getPlaybook(id);
  }

  async getWithDependencies(id: string): Promise<PlaybookWithDependencies | null> {
    const playbook = await this.db.getPlaybook(id);
    if (!playbook) {
      return null;
    }

    return {
      ...playbook,
      dependencies: await this.resolveDependencies(playbook),
    };
  }

  async update(id: string, input: UpdatePlaybookInput): Promise<Playbook | null> {
    const validated = UpdatePlaybookSchema.parse(input);
    return this.db.updatePlaybook(id, validated);
  }

  async delete(id: string): Promise<boolean> {
    return this.db.deletePlaybook(id);
  }

  async addToDeck(input: AddPlaybookToDeckInput): Promise<void> {
    const playbook = await this.db.getPlaybook(input.playbookId);
    if (!playbook) {
      throw new Error(`Playbook not found: ${input.playbookId}`);
    }

    await this.db.addPlaybookToDeck(input);
  }

  async removeFromDeck(input: RemovePlaybookFromDeckInput): Promise<void> {
    await this.db.removePlaybookFromDeck(input);
  }

  async resolveDependencies(playbook: Playbook): Promise<PlaybookDependencies> {
    const credentials: PlaybookDependencies['credentials'] = [];
    const services: PlaybookDependencies['services'] = [];
    const missingCredentialIds: string[] = [];
    const missingServiceIds: string[] = [];

    for (const credentialId of playbook.dependsOnCredentialIds) {
      const credential = await this.db.getCredential(credentialId);
      if (credential) {
        credentials.push({ id: credential.id, label: credential.label });
      } else {
        missingCredentialIds.push(credentialId);
      }
    }

    for (const serviceId of playbook.dependsOnServiceIds) {
      const service = await this.db.getService(serviceId);
      if (service) {
        services.push({ id: service.id, label: service.name });
      } else {
        missingServiceIds.push(serviceId);
      }
    }

    return {
      credentials,
      services,
      missingCredentialIds,
      missingServiceIds,
    };
  }

  async getDependentsForCredential(credentialId: string): Promise<PlaybookDependent[]> {
    const playbooks = await this.db.getPlaybooksDependingOnCredential(credentialId);
    return playbooks.map(({ id, title }) => ({ id, title }));
  }

  async getDependentsForService(serviceId: string): Promise<PlaybookDependent[]> {
    const playbooks = await this.db.getPlaybooksDependingOnService(serviceId);
    return playbooks.map(({ id, title }) => ({ id, title }));
  }

  assertNoDependents(dependents: PlaybookDependent[], resourceLabel: string): void {
    if (dependents.length === 0) {
      return;
    }

    const names = dependents.map((playbook) => playbook.title).join(', ');
    throw new PlaybookDependencyError(
      `Cannot remove ${resourceLabel}: referenced by playbook(s): ${names}`,
      dependents,
    );
  }
}
