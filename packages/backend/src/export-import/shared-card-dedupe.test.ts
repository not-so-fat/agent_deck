import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseManager } from '../models/database';
import { buildExportBundle } from './export-bundle';
import { importBundle } from './import-bundle';

describe('shared card dedupe', () => {
  let sourcePath: string;
  let targetPath: string;
  let source: DatabaseManager;
  let target: DatabaseManager;

  beforeEach(() => {
    sourcePath = path.join(os.tmpdir(), `agent-deck-dedupe-src-${Date.now()}.db`);
    targetPath = path.join(os.tmpdir(), `agent-deck-dedupe-dst-${Date.now()}.db`);
    source = new DatabaseManager(sourcePath);
    target = new DatabaseManager(targetPath);
  });

  afterEach(() => {
    source.close();
    target.close();
    fs.rmSync(sourcePath, { force: true });
    fs.rmSync(targetPath, { force: true });
  });

  it('export all lists a shared service once and import links both decks', async () => {
    const service = await source.createService({
      name: 'Linear',
      type: 'mcp',
      url: 'https://mcp.linear.app/mcp',
    });
    const playbook = await source.createPlaybook({
      id: 'pb_shared',
      title: 'Shared PB',
      body: 'shared',
      triggers: [],
      dependsOnCredentialIds: [],
      dependsOnServiceIds: [service.id],
    });

    const deckA = await source.createDeck({ name: 'alpha' });
    const deckB = await source.createDeck({ name: 'beta' });
    await source.addServiceToDeck({ deckId: deckA.id, serviceId: service.id });
    await source.addServiceToDeck({ deckId: deckB.id, serviceId: service.id });
    await source.addPlaybookToDeck({ deckId: deckA.id, playbookId: playbook.id });
    await source.addPlaybookToDeck({ deckId: deckB.id, playbookId: playbook.id });

    const bundle = await buildExportBundle(
      source,
      { scope: 'collection' },
      { agentDeckVersion: 'test' },
    );

    expect(bundle.services).toHaveLength(1);
    expect(bundle.playbooks).toHaveLength(1);
    expect(bundle.decks).toHaveLength(2);
    expect(bundle.decks.every((deck) => deck.serviceIds[0] === service.id)).toBe(
      true,
    );

    const report = await importBundle(target, bundle);
    expect(report.counts.services).toEqual({ created: 1, reused: 0 });
    expect(report.counts.playbooks).toEqual({ created: 1, reused: 0 });
    expect(report.counts.decks).toEqual({ created: 2, reused: 0 });

    const services = await target.getAllServices();
    expect(services).toHaveLength(1);
    const decks = await target.getAllDecks();
    expect(decks).toHaveLength(2);
    for (const deck of decks) {
      expect(deck.services.map((row) => row.id)).toEqual([services[0].id]);
      expect(deck.playbooks.map((row) => row.id)).toEqual([
        report.idMap.pb_shared,
      ]);
    }
  });

  it('two deck-unit imports reuse one Linear and remap new playbook deps', async () => {
    const service = await source.createService({
      name: 'Linear',
      type: 'mcp',
      url: 'https://mcp.linear.app/mcp',
    });

    const deckA = await source.createDeck({ name: 'deck-a' });
    await source.addServiceToDeck({ deckId: deckA.id, serviceId: service.id });
    const playbookA = await source.createPlaybook({
      id: 'pb_a',
      title: 'Playbook A',
      body: 'A',
      triggers: [],
      dependsOnCredentialIds: [],
      dependsOnServiceIds: [service.id],
    });
    await source.addPlaybookToDeck({
      deckId: deckA.id,
      playbookId: playbookA.id,
    });

    const deckB = await source.createDeck({ name: 'deck-b' });
    await source.addServiceToDeck({ deckId: deckB.id, serviceId: service.id });
    const playbookB = await source.createPlaybook({
      id: 'pb_b',
      title: 'Playbook B',
      body: 'B',
      triggers: [],
      dependsOnCredentialIds: [],
      dependsOnServiceIds: [service.id],
    });
    await source.addPlaybookToDeck({
      deckId: deckB.id,
      playbookId: playbookB.id,
    });

    const bundleA = await buildExportBundle(
      source,
      { scope: 'deck', deckId: deckA.id },
      { agentDeckVersion: 'test' },
    );
    const bundleB = await buildExportBundle(
      source,
      { scope: 'deck', deckId: deckB.id },
      { agentDeckVersion: 'test' },
    );

    // Different within-file service ids (simulate independent exports).
    bundleB.services[0] = {
      ...bundleB.services[0],
      id: '99999999-9999-4999-8999-999999999999',
    };
    bundleB.decks[0].serviceIds = ['99999999-9999-4999-8999-999999999999'];
    bundleB.playbooks[0].dependsOnServiceIds = [
      '99999999-9999-4999-8999-999999999999',
    ];

    const reportA = await importBundle(target, bundleA);
    expect(reportA.counts.services).toEqual({ created: 1, reused: 0 });
    expect(reportA.counts.playbooks).toEqual({ created: 1, reused: 0 });

    const linearId = reportA.idMap[bundleA.services[0].id];
    const playbookABefore = await target.getPlaybook(reportA.idMap.pb_a);
    expect(playbookABefore?.dependsOnServiceIds).toEqual([linearId]);

    const reportB = await importBundle(target, bundleB);
    expect(reportB.counts.services).toEqual({ created: 0, reused: 1 });
    expect(reportB.counts.playbooks).toEqual({ created: 1, reused: 0 });
    expect(reportB.idMap['99999999-9999-4999-8999-999999999999']).toBe(linearId);

    const services = await target.getAllServices();
    expect(services).toHaveLength(1);
    expect(services[0].id).toBe(linearId);

    const playbookBImported = await target.getPlaybook(reportB.idMap.pb_b);
    expect(playbookBImported?.dependsOnServiceIds).toEqual([linearId]);

    const playbookAAfter = await target.getPlaybook(reportA.idMap.pb_a);
    expect(playbookAAfter?.dependsOnServiceIds).toEqual([linearId]);
    expect(playbookAAfter?.body).toBe('A');

    const decks = await target.getAllDecks();
    expect(decks).toHaveLength(2);
    expect(decks.every((deck) => deck.services[0]?.id === linearId)).toBe(true);
  });
});
