import { getCliPackageRoot } from './paths';

export type StubSyncResult = {
  cursor: { created: number; updated: number; removed: number; dir: string };
  claude: { created: number; updated: number; removed: number; dirs: string[] };
};

function loadStubSyncModule(): {
  syncPlaybookStubs: (
    workspaceRoot: string,
    playbooks: Array<{ id: string; title: string; triggers: string[] }>,
    options?: { cursor?: boolean; claude?: boolean },
  ) => StubSyncResult;
  readUseManifest: (workspaceRoot: string) => {
    version: 1;
    deckId: string;
    deckName: string;
    mcpUrl: string;
    updatedAt: string;
  } | null;
  writeUseManifest: (
    workspaceRoot: string,
    manifest: {
      version: 1;
      deckId: string;
      deckName: string;
      mcpUrl: string;
      updatedAt: string;
    },
  ) => string;
} {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(require.resolve('@agent-deck/backend/playbooks/stub-sync', {
    paths: [getCliPackageRoot()],
  }));
}

const stubSync = loadStubSyncModule();

export const syncPlaybookStubs = stubSync.syncPlaybookStubs;
export const readUseManifest = stubSync.readUseManifest;
export const writeUseManifest = stubSync.writeUseManifest;
