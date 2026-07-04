import { createCollectionAdmin } from './backend-runtime';

function printCollectionUsage(): void {
  console.log(`Usage:
  agent-deck service list
  agent-deck service delete <service-id>
  agent-deck playbook list
  agent-deck playbook delete <playbook-id>
  agent-deck deck list
  agent-deck deck delete <deck-id>

Rare collection ops (not MCP). Create decks via MCP create_deck; secrets via credential commands.`);
}

async function runDelete(
  kind: 'service' | 'playbook' | 'deck',
  id: string | undefined,
): Promise<number> {
  if (!id) {
    console.error(`Missing ${kind} id`);
    return 1;
  }

  const admin = createCollectionAdmin();
  const result =
    kind === 'service'
      ? await admin.deleteService(id)
      : kind === 'playbook'
        ? await admin.deletePlaybook(id)
        : await admin.deleteDeck(id);

  if (!result.ok) {
    console.error(result.error);
    return 1;
  }

  console.log(`Deleted ${kind} ${id}`);
  return 0;
}

export async function runServiceCommand(args: string[]): Promise<number> {
  const subcommand = args[0];
  if (subcommand === 'list') {
    const services = await createCollectionAdmin().listServices();
    if (services.length === 0) {
      console.log('No services registered');
      return 0;
    }
    for (const service of services) {
      console.log(`${service.id}\t${service.name}\t${service.type}`);
    }
    return 0;
  }
  if (subcommand === 'delete') {
    return runDelete('service', args[1]);
  }
  printCollectionUsage();
  return 1;
}

export async function runPlaybookCommand(args: string[]): Promise<number> {
  const subcommand = args[0];
  if (subcommand === 'list') {
    const playbooks = await createCollectionAdmin().listPlaybooks();
    if (playbooks.length === 0) {
      console.log('No playbooks registered');
      return 0;
    }
    for (const playbook of playbooks) {
      console.log(`${playbook.id}\t${playbook.title}`);
    }
    return 0;
  }
  if (subcommand === 'delete') {
    return runDelete('playbook', args[1]);
  }
  printCollectionUsage();
  return 1;
}

export async function runDeckCommand(args: string[]): Promise<number> {
  const subcommand = args[0];
  if (subcommand === 'list') {
    const decks = await createCollectionAdmin().listDecks();
    if (decks.length === 0) {
      console.log('No decks registered');
      return 0;
    }
    for (const deck of decks) {
      console.log(`${deck.id}\t${deck.name}`);
    }
    return 0;
  }
  if (subcommand === 'delete') {
    return runDelete('deck', args[1]);
  }
  printCollectionUsage();
  return 1;
}
