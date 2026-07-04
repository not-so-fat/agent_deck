import { describe, expect, it } from 'vitest';
import {
  BundleV1Schema,
  ExportRequestSchema,
  ImportReportSchema,
} from './export-bundle';

const validBundle = {
  format: 'agent-deck-bundle' as const,
  version: 1 as const,
  exportedAt: '2026-07-03T00:00:00.000Z',
  exportedFrom: { agentDeckVersion: '1.3.0' },
  scope: 'collection' as const,
  services: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Linear',
      type: 'mcp' as const,
      url: 'https://mcp.linear.app/mcp',
    },
  ],
  playbooks: [
    {
      id: 'pb_example',
      title: 'Example',
      body: 'Do the thing',
      triggers: ['example'],
      dependsOnServiceIds: ['11111111-1111-4111-8111-111111111111'],
    },
  ],
  decks: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'dev',
      serviceIds: ['11111111-1111-4111-8111-111111111111'],
      playbookIds: ['pb_example'],
    },
  ],
};

describe('BundleV1Schema', () => {
  it('accepts a valid collection bundle', () => {
    const result = BundleV1Schema.safeParse(validBundle);
    expect(result.success).toBe(true);
  });

  it('rejects unknown format', () => {
    const result = BundleV1Schema.safeParse({ ...validBundle, format: 'other' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown version', () => {
    const result = BundleV1Schema.safeParse({ ...validBundle, version: 2 });
    expect(result.success).toBe(false);
  });

  it('rejects credential-shaped fields on services (strict)', () => {
    const result = BundleV1Schema.safeParse({
      ...validBundle,
      services: [
        {
          ...validBundle.services[0],
          credentialId: 'cred_x',
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects secret-shaped fields on services (strict)', () => {
    for (const field of [
      'oauthClientSecret',
      'oauthAccessToken',
      'oauthRefreshToken',
      'localEnv',
    ]) {
      const result = BundleV1Schema.safeParse({
        ...validBundle,
        services: [
          {
            ...validBundle.services[0],
            [field]: field === 'localEnv' ? { API_KEY: 'x' } : 'secret',
          },
        ],
      });
      expect(result.success).toBe(false);
    }
  });

  it('rejects credentials array on bundle (strict)', () => {
    const result = BundleV1Schema.safeParse({
      ...validBundle,
      credentials: [{ id: 'cred_x' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid playbook id', () => {
    const result = BundleV1Schema.safeParse({
      ...validBundle,
      playbooks: [{ id: 'not-a-playbook', title: 'X', body: '', triggers: [] }],
    });
    expect(result.success).toBe(false);
  });
});

describe('ExportRequestSchema', () => {
  it('defaults scope to collection', () => {
    const result = ExportRequestSchema.parse({});
    expect(result.scope).toBe('collection');
  });

  it('requires deckId when scope is deck', () => {
    const result = ExportRequestSchema.safeParse({ scope: 'deck' });
    expect(result.success).toBe(false);
  });

  it('accepts deck scope with deckId', () => {
    const result = ExportRequestSchema.safeParse({
      scope: 'deck',
      deckId: '22222222-2222-4222-8222-222222222222',
    });
    expect(result.success).toBe(true);
  });
});

describe('ImportReportSchema', () => {
  it('accepts a completed report', () => {
    const result = ImportReportSchema.safeParse({
      status: 'completed',
      counts: {
        services: { created: 1, reused: 0 },
        playbooks: { created: 0, reused: 1 },
        decks: { created: 1, reused: 0 },
      },
      servicesNeedingOauth: ['Linear'],
      warnings: [],
      idMap: { a: 'b' },
    });
    expect(result.success).toBe(true);
  });
});
