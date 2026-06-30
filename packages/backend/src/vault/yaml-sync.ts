import fs from 'fs/promises';
import path from 'path';
import { Credential } from '@agent-deck/shared';
import { resolveAgentDeckHome } from '../lib/paths';

export function getAgentDeckHome(): string {
  return resolveAgentDeckHome();
}

export function getCredentialsDir(): string {
  return path.join(getAgentDeckHome(), 'credentials');
}

export class CredentialYamlSync {
  async write(credential: Credential): Promise<void> {
    const dir = getCredentialsDir();
    await fs.mkdir(dir, { recursive: true });

    const payload = {
      id: credential.id,
      label: credential.label,
      scheme: credential.scheme,
      header_name: credential.headerName ?? null,
      env_name: credential.envName,
      tags: credential.tags,
      docs_url: credential.docsUrl ?? null,
    };

    const filePath = path.join(dir, `${credential.id}.yaml`);
    const lines = [
      `# Agent Deck credential metadata (secret stored in Keychain)`,
      `id: ${payload.id}`,
      `label: ${JSON.stringify(payload.label)}`,
      `scheme: ${payload.scheme}`,
      `header_name: ${payload.header_name === null ? 'null' : JSON.stringify(payload.header_name)}`,
      `env_name: ${payload.env_name}`,
      `tags: [${payload.tags.map((tag) => JSON.stringify(tag)).join(', ')}]`,
      ...(payload.docs_url
        ? [`docs_url: ${JSON.stringify(payload.docs_url)}`]
        : []),
      '',
    ];

    await fs.writeFile(filePath, lines.join('\n'), 'utf8');
  }

  async remove(credentialId: string): Promise<void> {
    const filePath = path.join(getCredentialsDir(), `${credentialId}.yaml`);
    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
