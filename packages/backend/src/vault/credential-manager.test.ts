import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '../models/database';
import { CredentialManager } from '../vault/credential-manager';
import { MemorySecretStore } from '../vault/secret-store';

describe('CredentialManager', () => {
  let db: DatabaseManager;
  let manager: CredentialManager;

  beforeEach(() => {
    process.env.AGENT_DECK_SECRET_STORE = 'memory';
    db = new DatabaseManager(':memory:');
    manager = new CredentialManager(db, new MemorySecretStore());
  });

  afterEach(() => {
    db.close();
    delete process.env.AGENT_DECK_SECRET_STORE;
  });

  it('creates credential metadata and stores secret in vault', async () => {
    const credential = await manager.create({
      id: 'cred_test',
      label: 'Test API',
      scheme: 'bearer',
      envName: 'TEST_API_KEY',
      value: 'secret-value',
      tags: ['test'],
    });

    expect(credential.id).toBe('cred_test');
    expect(credential.hasSecret).toBe(true);

    const listed = await manager.list();
    expect(listed).toHaveLength(1);
    expect(listed[0].envName).toBe('TEST_API_KEY');
  });

  it('resolves env map for exec without exposing values in metadata', async () => {
    await manager.create({
      id: 'cred_openai',
      label: 'OpenAI',
      scheme: 'bearer',
      envName: 'OPENAI_API_KEY',
      value: 'sk-test',
      tags: [],
    });

    const env = await manager.resolveEnvMap(['cred_openai']);
    expect(env.OPENAI_API_KEY).toBe('sk-test');
  });

  it('records exec runs with credential ids only', async () => {
    await manager.create({
      id: 'cred_slack',
      label: 'Slack',
      scheme: 'bearer',
      envName: 'SLACK_BOT_TOKEN',
      value: 'xoxb-test',
      tags: [],
    });

    const run = await manager.recordExecRun({
      command: 'echo hello',
      credentialIds: ['cred_slack'],
      exitCode: 0,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    });

    expect(run.credentialIds).toEqual(['cred_slack']);
    expect(run.command).toBe('echo hello');
  });
});
