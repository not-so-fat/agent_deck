import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '../models/database';
import { DEFAULT_MCP_SERVICES } from './default-mcp-services';
import { seedDefaultServicesIfEmpty } from './seed-default-services';

describe('seedDefaultServicesIfEmpty', () => {
  let dbManager: DatabaseManager;

  beforeEach(() => {
    dbManager = new DatabaseManager(':memory:');
  });

  afterEach(() => {
    dbManager.close();
  });

  it('seeds default MCP cards when services table is empty', async () => {
    expect(dbManager.hasAnyServices()).toBe(false);

    const seeded = await seedDefaultServicesIfEmpty(dbManager);

    expect(seeded).toBe(DEFAULT_MCP_SERVICES.length);
    const services = await dbManager.getAllServices();
    expect(services).toHaveLength(DEFAULT_MCP_SERVICES.length);

    for (const preset of DEFAULT_MCP_SERVICES) {
      const match = services.find((service) => service.name === preset.name);
      expect(match).toBeDefined();
      expect(match?.url).toBe(preset.url);
      expect(match?.type).toBe('mcp');
      expect(match?.cardColor).toBe(preset.cardColor);
    }
  });

  it('does not re-seed when services already exist', async () => {
    await dbManager.createService({
      name: 'Existing Service',
      type: 'mcp',
      url: 'https://example.com',
    });

    const seeded = await seedDefaultServicesIfEmpty(dbManager);

    expect(seeded).toBe(0);
    const services = await dbManager.getAllServices();
    expect(services).toHaveLength(1);
    expect(services[0]?.name).toBe('Existing Service');
  });
});
