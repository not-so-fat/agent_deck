import { z } from 'zod';

/** Minimal repo manifest at `.agent-deck/deck.yaml` — links a workspace to a dashboard deck. */
export const RepoDeckManifestSchema = z.object({
  deck_id: z.string().uuid('deck_id must be a valid Agent Deck UUID'),
  name: z.string().min(1).optional(),
});

export type RepoDeckManifest = z.infer<typeof RepoDeckManifestSchema>;

export const REPO_DECK_MANIFEST_PATH = '.agent-deck/deck.yaml';
