import { describe, it, expect } from 'vitest';
import {
  deriveCredentialDefaults,
  deriveCredentialIdFromLabel,
  deriveEnvNameFromLabel,
} from './credential';

describe('credential utils', () => {
  it('derives id and env name from label', () => {
    expect(deriveCredentialIdFromLabel('OpenAI')).toBe('cred_openai');
    expect(deriveEnvNameFromLabel('OpenAI')).toBe('OPENAI_API_KEY');
  });

  it('builds full defaults for simple create', () => {
    expect(deriveCredentialDefaults('Linear API')).toEqual({
      id: 'cred_linear_api',
      label: 'Linear API',
      scheme: 'bearer',
      envName: 'LINEAR_API_KEY',
      tags: [],
    });
  });
});
