import type { BootstrapResult } from './run-bootstrap';
import { GUIDE_REF } from './authoring-guide';

export const PRIVACY_NOTE =
  'Note: digests include verbatim user-reaction excerpts. Parsing is local; digests enter your agent context when authoring.';

export function formatHandoffBlock(result: BootstrapResult): string {
  return [
    '--- agent-deck bootstrap handoff ---',
    `1. Load the authoring guide: ${result.guidePath}`,
    `   (guideRef: ${GUIDE_REF})`,
    `2. Read the manifest: ${result.manifestPath}`,
    '3. Bind the workspace you are in, then propose playbooks for the bound deck only',
    '   (load digests whose workspaceRoot matches; hold others).',
    '--- end handoff ---',
  ].join('\n');
}

export function formatBootstrapOutput(result: BootstrapResult): string {
  return `${PRIVACY_NOTE}\n${formatHandoffBlock(result)}`;
}
