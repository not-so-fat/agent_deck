import {
  createCredentialManager,
  parseConnections,
  readSecretFromStdin,
  runCommand,
} from './lib/runtime';

import { runDebugMcp } from './debug-mcp';
import { runDoctor, runStart } from './start';
import { runSetup, shouldStartAfterSetup } from './setup';
import { runStatus } from './status';
import { runStatusline } from './statusline';
import { runMenubar } from './menubar';
import { runStop } from './stop';
import { runUpgrade } from './upgrade';
import { getAgentDeckVersion } from './version';

type VaultManager = {
  create: (input: unknown) => Promise<unknown>;
  get: (id: string) => Promise<{ id: string; envName: string } | null>;
  list: () => Promise<Array<{ id: string; label: string; envName: string; scheme: string; hasSecret?: boolean }>>;
  rotate: (id: string, input: { value: string }) => Promise<unknown | null>;
  assertCredentialsOnDeck: (deckId: string, credentialIds: string[]) => Promise<void>;
  resolveEnvMap: (credentialIds: string[]) => Promise<Record<string, string>>;
  recordExecRun: (input: unknown) => Promise<unknown>;
};

function getVaultManager(): VaultManager {
  return createCredentialManager() as VaultManager;
}

function printUsage() {
  console.log(`Usage:
  agent-deck start [--open] [--no-ui] [--force] [--port PORT] [--mcp-port PORT]
  agent-deck stop
  agent-deck status
  agent-deck statusline [--workspace <path>]
  agent-deck menubar
  agent-deck setup --client cursor|claude|claude-desktop [--scope global|project] [--start]
  agent-deck upgrade [--check]
  agent-deck doctor
  agent-deck debug-mcp
  agent-deck --version
  agent-deck credential add <id> --env-name ENV_NAME --scheme bearer|header|http_basic_user [--label LABEL] [--header-name NAME] [--tags tag1,tag2]
  agent-deck credential list
  agent-deck credential rotate <id>
  agent-deck exec [--deck DECK_ID] [--connections cred_a,cred_b] [--dry-run] -- <command...>`);
}

export async function runCredentialAdd(args: string[]): Promise<number> {
  const id = args[0];
  if (!id) {
    console.error('Missing credential id (expected cred_<slug>)');
    return 1;
  }

  let envName = '';
  let scheme: 'bearer' | 'header' | 'http_basic_user' = 'bearer';
  let label = id;
  let headerName: string | undefined;
  let tags: string[] = [];

  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--env-name') {
      envName = args[++i] ?? '';
    } else if (arg === '--scheme') {
      scheme = (args[++i] ?? 'bearer') as typeof scheme;
    } else if (arg === '--label') {
      label = args[++i] ?? id;
    } else if (arg === '--header-name') {
      headerName = args[++i];
    } else if (arg === '--tags') {
      tags = (args[++i] ?? '').split(',').map((tag) => tag.trim()).filter(Boolean);
    }
  }

  if (!envName) {
    console.error('--env-name is required');
    return 1;
  }

  const value = await readSecretFromStdin(`Enter secret value for ${id}: `);
  if (!value) {
    console.error('Secret value is required');
    return 1;
  }

  const manager = getVaultManager();
  await manager.create({
    id,
    label,
    scheme,
    headerName,
    envName,
    tags,
    value,
  });

  console.log(`Credential ${id} saved to vault`);
  return 0;
}

export async function runCredentialList(): Promise<number> {
  const manager = getVaultManager();
  const credentials = await manager.list();

  if (credentials.length === 0) {
    console.log('No credentials registered');
    return 0;
  }

  for (const credential of credentials) {
    console.log(
      `${credential.id}\t${credential.label}\t${credential.envName}\t${credential.scheme}\tsecret=${credential.hasSecret ? 'yes' : 'no'}`,
    );
  }

  return 0;
}

export async function runCredentialRotate(id: string): Promise<number> {
  if (!id) {
    console.error('Missing credential id');
    return 1;
  }

  const value = await readSecretFromStdin(`Enter new secret value for ${id}: `);
  if (!value) {
    console.error('Secret value is required');
    return 1;
  }

  const manager = getVaultManager();
  const rotated = await manager.rotate(id, { value });
  if (!rotated) {
    console.error(`Credential not found: ${id}`);
    return 1;
  }

  console.log(`Credential ${id} rotated`);
  return 0;
}

export async function runExec(args: string[]): Promise<number> {
  let deckId: string | undefined;
  let connectionsArg: string | undefined;
  let dryRun = false;
  const commandStart = args.indexOf('--');

  let optionArgs = commandStart === -1 ? args : args.slice(0, commandStart);
  const commandArgs = commandStart === -1 ? [] : args.slice(commandStart + 1);

  for (let i = 0; i < optionArgs.length; i += 1) {
    const arg = optionArgs[i];
    if (arg === '--deck') {
      deckId = optionArgs[++i];
    } else if (arg === '--connections') {
      connectionsArg = optionArgs[++i];
    } else if (arg === '--dry-run') {
      dryRun = true;
    }
  }

  if (commandArgs.length === 0) {
    console.error('Missing command after --');
    return 1;
  }

  const credentialIds = parseConnections(connectionsArg);
  if (credentialIds.length === 0) {
    console.error('--connections is required (comma-separated credential ids)');
    return 1;
  }

  const manager = getVaultManager();
  const startedAt = new Date().toISOString();
  const command = commandArgs.join(' ');

  if (deckId) {
    try {
      await manager.assertCredentialsOnDeck(deckId, credentialIds);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      return 1;
    }
  }

  if (dryRun) {
    const credentials = await Promise.all(credentialIds.map((id) => manager.get(id)));
    console.log('Dry run — would inject environment variables:');
    for (const credential of credentials) {
      if (!credential) {
        console.error(`Credential not found`);
        return 1;
      }
      console.log(`  ${credential.envName}=<secret from ${credential.id}>`);
    }
    console.log(`Would run: ${command}`);
    return 0;
  }

  const env = await manager.resolveEnvMap(credentialIds);
  const [cmd, ...cmdArgs] = commandArgs;
  const exitCode = await runCommand(cmd, cmdArgs, env);

  await manager.recordExecRun({
    deckId,
    command,
    credentialIds,
    exitCode,
    startedAt,
    finishedAt: new Date().toISOString(),
  });

  return exitCode;
}

export async function runCredentialCommand(args: string[]): Promise<number> {
  const subcommand = args[0];

  switch (subcommand) {
    case 'add':
      return runCredentialAdd(args.slice(1));
    case 'list':
      return runCredentialList();
    case 'rotate':
      return runCredentialRotate(args[1]);
    default:
      printUsage();
      return 1;
  }
}

export async function runCli(argv: string[]): Promise<number> {
  const [, , command, ...rest] = argv;

  if (command === '--version' || command === '-V' || command === '-v') {
    console.log(getAgentDeckVersion());
    return 0;
  }

  switch (command) {
    case 'start': {
      let openBrowser = false;
      let skipUi = false;
      let force = false;
      let backendPort: number | undefined;
      let mcpPort: number | undefined;

      for (let i = 0; i < rest.length; i += 1) {
        const arg = rest[i];
        if (arg === '--open') {
          openBrowser = true;
        } else if (arg === '--no-ui') {
          skipUi = true;
        } else if (arg === '--force') {
          force = true;
        } else if (arg === '--port') {
          backendPort = Number.parseInt(rest[++i] ?? '', 10);
        } else if (arg === '--mcp-port') {
          mcpPort = Number.parseInt(rest[++i] ?? '', 10);
        } else if (arg === '--help' || arg === '-h') {
          printUsage();
          return 0;
        }
      }

      return runStart({ openBrowser, skipUi, force, backendPort, mcpPort });
    }
    case 'stop':
      return runStop();
    case 'status':
      return runStatus();
    case 'statusline':
      return runStatusline(rest);
    case 'menubar':
      return await runMenubar();
    case 'setup': {
      const code = await runSetup(rest);
      if (shouldStartAfterSetup(code)) {
        return runStart({});
      }
      return code;
    }
    case 'upgrade':
      return runUpgrade(rest);
    case 'doctor':
      return runDoctor();
    case 'debug-mcp':
      return runDebugMcp();
    case 'credential':
      return runCredentialCommand(rest);
    case 'exec':
      return runExec(rest);
    default:
      printUsage();
      return command ? 1 : 0;
  }
}
