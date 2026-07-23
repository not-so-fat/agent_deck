import { getCliPackageRoot } from './paths';

type BootstrapHostOption = 'claude' | 'cursor' | 'all';

type BootstrapOptions = {
  projectsDir?: string;
  claudeProjectsDir?: string;
  cursorProjectsDir?: string;
  host?: BootstrapHostOption;
  outDir?: string;
  workspace?: string;
  since?: string;
  limit?: number;
};

type BootstrapResult = {
  outDir: string;
  manifestPath: string;
  guidePath: string;
  latestPointerPath: string;
  manifest: {
    totalSessions: number;
    hosts: { claude: number; cursor: number };
    workspaces: unknown[];
  };
  warning?: string;
};

type BootstrapRuntime = {
  runBootstrap: (options: BootstrapOptions) => BootstrapResult;
  formatBootstrapOutput: (result: BootstrapResult) => string;
};

function getBootstrapRuntime(): BootstrapRuntime {
  const bootstrapRuntime = require.resolve('@agent-deck/backend/bootstrap', {
    paths: [getCliPackageRoot()],
  });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(bootstrapRuntime) as BootstrapRuntime;
}

function printBootstrapUsage(): void {
  console.log(`Usage:
  agent-deck bootstrap [--host claude|cursor|all] [--workspace <path>] [--since <date>] [--limit <n>] [--out <dir>]

Mine local Claude Code and/or Cursor agent session history into playbook-proposal digests (offline).`);
}

function parseBootstrapArgs(
  args: string[],
): { ok: true; options: BootstrapOptions } | { ok: false; error: string } {
  const options: BootstrapOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      return { ok: false, error: 'help' };
    }

    const value = args[++index];
    if (!value || value.startsWith('--')) {
      return { ok: false, error: `Missing value for ${arg}` };
    }

    switch (arg) {
      case '--workspace':
        options.workspace = value;
        break;
      case '--since':
        options.since = value;
        break;
      case '--limit': {
        const limit = Number(value);
        if (!Number.isInteger(limit) || limit < 0) {
          return { ok: false, error: `Invalid --limit: ${value}` };
        }
        options.limit = limit;
        break;
      }
      case '--out':
        options.outDir = value;
        break;
      case '--projects-dir':
        options.projectsDir = value;
        options.claudeProjectsDir = value;
        break;
      case '--claude-projects-dir':
        options.claudeProjectsDir = value;
        break;
      case '--cursor-projects-dir':
        options.cursorProjectsDir = value;
        break;
      case '--host':
        if (value !== 'claude' && value !== 'cursor' && value !== 'all') {
          return { ok: false, error: `Invalid --host: ${value} (expected claude|cursor|all)` };
        }
        options.host = value;
        break;
      default:
        return { ok: false, error: `Unknown argument: ${arg}` };
    }
  }

  return { ok: true, options };
}

export async function runBootstrapCommand(args: string[]): Promise<number> {
  const parsed = parseBootstrapArgs(args);
  if (!parsed.ok) {
    if (parsed.error !== 'help') {
      console.error(parsed.error);
    }
    printBootstrapUsage();
    return parsed.error === 'help' ? 0 : 1;
  }

  try {
    const { runBootstrap, formatBootstrapOutput } = getBootstrapRuntime();
    const result = runBootstrap(parsed.options);
    const hosts = result.manifest.hosts ?? { claude: 0, cursor: 0 };
    console.log(
      `Bootstrap mined ${result.manifest.totalSessions} sessions across ${result.manifest.workspaces.length} workspaces (claude=${hosts.claude} cursor=${hosts.cursor}).`,
    );
    console.log(`Output: ${result.outDir}`);
    console.log(`Manifest: ${result.manifestPath}`);
    console.log(`Authoring guide: ${result.guidePath}`);
    if (result.warning) {
      console.warn(`Warning: ${result.warning}`);
    }
    console.log(formatBootstrapOutput(result));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }
}
