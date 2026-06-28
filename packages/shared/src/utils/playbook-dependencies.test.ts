import { describe, expect, it } from 'vitest';
import {
  buildPlaybookSearchText,
  detectPlaybookDependencies,
  type PlaybookDependencyCatalog,
} from './playbook-dependencies';

const catalog: PlaybookDependencyCatalog = {
  credentials: [
    { id: 'cred_ashby', label: 'Ashby', envName: 'ASHBY_API_KEY' },
    { id: 'cred_openai', label: 'OpenAI', envName: 'OPENAI_API_KEY' },
  ],
  services: [
    { id: '11111111-1111-1111-1111-111111111111', name: 'Linear MCP' },
    { id: '22222222-2222-2222-2222-222222222222', name: 'Slack' },
  ],
};

describe('detectPlaybookDependencies', () => {
  it('detects credential ids and --connections flags', () => {
    const text = buildPlaybookSearchText({
      body: 'Use cred_ashby for applicants.',
      exec: 'agent-deck exec --connections cred_ashby,cred_openai -- uv run hiring inbox',
    });

    const result = detectPlaybookDependencies(text, catalog);

    expect(result.dependsOnCredentialIds).toEqual(['cred_ashby', 'cred_openai']);
  });

  it('detects env names and service uuids', () => {
    const text = `
      Export OPENAI_API_KEY before calling 11111111-1111-1111-1111-111111111111.
    `;

    const result = detectPlaybookDependencies(text, catalog);

    expect(result.dependsOnCredentialIds).toEqual(['cred_openai']);
    expect(result.dependsOnServiceIds).toEqual(['11111111-1111-1111-1111-111111111111']);
  });

  it('detects service names and merges explicit ids', () => {
    const text = 'Post updates through Slack after triage.';

    const result = detectPlaybookDependencies(text, catalog, {
      credentialIds: ['cred_ashby'],
    });

    expect(result.dependsOnCredentialIds).toEqual(['cred_ashby']);
    expect(result.dependsOnServiceIds).toEqual(['22222222-2222-2222-2222-222222222222']);
  });
});
