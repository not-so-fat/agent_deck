import { createExportImport } from './backend-runtime';

function printExportUsage(): void {
  console.log(`Usage:
  agent-deck export all --output <path>
  agent-deck export deck <uuid> --output <path>

Units:
  all   Whole collection + every deck layout (MCP, playbooks, membership)
  deck  One deck as a unit (that deck + its linked MCP/playbooks only)

Credentials and secrets are never included.
Import tries to create each card/deck; unique display names that already exist are skipped (linked as-is).`);
}

function printImportUsage(): void {
  console.log(`Usage:
  agent-deck import <path>

Import a previously exported .agent-deck.json bundle.
Creates new cards/decks; skips any whose display name already exists (reports at end).
Prints an ImportReport JSON on stdout.`);
}

export function parseExportArgs(args: string[]): {
  ok: true;
  output: string;
  scope: 'collection' | 'deck';
  deckId?: string;
} | { ok: false; error: string } {
  const unit = args[0];
  if (!unit || unit === '--help' || unit === '-h') {
    return { ok: false, error: 'help' };
  }

  let scope: 'collection' | 'deck';
  let deckId: string | undefined;
  let rest: string[];

  if (unit === 'all') {
    scope = 'collection';
    rest = args.slice(1);
  } else if (unit === 'deck') {
    scope = 'deck';
    deckId = args[1];
    if (!deckId || deckId.startsWith('-')) {
      return { ok: false, error: 'Missing deck <uuid>' };
    }
    rest = args.slice(2);
  } else {
    return {
      ok: false,
      error: `Unknown export unit "${unit}" (use "all" or "deck")`,
    };
  }

  let output: string | undefined;
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--output' || arg === '-o') {
      output = rest[++i];
    } else if (arg === '--help' || arg === '-h') {
      return { ok: false, error: 'help' };
    } else {
      return { ok: false, error: `Unknown argument: ${arg}` };
    }
  }

  if (!output) {
    return { ok: false, error: 'Missing --output <path>' };
  }

  return { ok: true, output, scope, deckId };
}

export async function runExportCommand(args: string[]): Promise<number> {
  const parsed = parseExportArgs(args);
  if (!parsed.ok) {
    if (parsed.error === 'help') {
      printExportUsage();
      return 0;
    }
    console.error(parsed.error);
    printExportUsage();
    return 1;
  }

  const result = await createExportImport().exportToFile(parsed.output, {
    scope: parsed.scope,
    deckId: parsed.deckId,
  });

  if (!result.ok) {
    console.error(result.error);
    return 1;
  }

  console.error(
    `Exported ${result.bundle.services.length} services, ${result.bundle.playbooks.length} playbooks, ${result.bundle.decks.length} decks to ${parsed.output}`,
  );
  return 0;
}

export async function runImportCommand(args: string[]): Promise<number> {
  const inputPath = args[0];
  if (!inputPath || inputPath === '--help' || inputPath === '-h') {
    printImportUsage();
    return inputPath ? 0 : 1;
  }
  if (args.length > 1) {
    console.error('Unexpected arguments');
    printImportUsage();
    return 1;
  }

  const result = await createExportImport().importFromFile(inputPath);
  if (!result.ok) {
    console.error(result.error);
    return 1;
  }

  console.log(JSON.stringify(result.report, null, 2));
  const { services, playbooks, decks } = result.report.counts;
  console.error(
    `Imported decks(created=${decks.created}, skipped=${decks.reused}) services(created=${services.created}, skipped=${services.reused}) playbooks(created=${playbooks.created}, skipped=${playbooks.reused})`,
  );
  return 0;
}
