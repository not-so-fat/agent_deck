import { z } from 'zod';

export const PlaybookIdSchema = z
  .string()
  .regex(/^pb_[a-z0-9_]+$/, 'Playbook id must match pb_<slug>');

export const PlaybookSchema = z.object({
  id: PlaybookIdSchema,
  title: z.string().min(1, 'Title is required'),
  body: z.string().default(''),
  triggers: z.array(z.string()).default([]),
  dependsOnCredentialIds: z.array(z.string()).default([]),
  dependsOnServiceIds: z.array(z.string()).default([]),
  exec: z.string().optional(),
  skill: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreatePlaybookSchema = z.object({
  id: PlaybookIdSchema.optional(),
  title: z.string().min(1, 'Title is required'),
  body: z.string().default(''),
  triggers: z.array(z.string()).default([]),
  dependsOnCredentialIds: z.array(z.string()).default([]),
  dependsOnServiceIds: z.array(z.string()).default([]),
  exec: z.string().optional(),
  skill: z.string().optional(),
});

export const UpdatePlaybookSchema = CreatePlaybookSchema.partial().omit({ id: true });

export const DashboardRegisterPlaybookSchema = CreatePlaybookSchema.extend({
  autoDetectDependencies: z.boolean().default(true),
});

export const DashboardUpdatePlaybookSchema = UpdatePlaybookSchema.extend({
  autoDetectDependencies: z.boolean().default(true),
});

export const AgentRegisterPlaybookSchema = CreatePlaybookSchema.extend({
  addToBoundDeck: z.boolean().default(true),
  autoDetectDependencies: z.boolean().default(true),
});

export const AgentUpdatePlaybookSchema = UpdatePlaybookSchema.extend({
  autoDetectDependencies: z.boolean().default(true),
});

export const DeckPlaybookSchema = z.object({
  deckId: z.string().uuid('Valid deck ID required'),
  playbookId: PlaybookIdSchema,
  position: z.number().int().min(0, 'Position must be non-negative'),
});

export const AddPlaybookToDeckSchema = DeckPlaybookSchema.omit({
  position: true,
}).extend({
  position: z.number().int().min(0).optional(),
});

export const RemovePlaybookFromDeckSchema = z.object({
  deckId: z.string().uuid('Valid deck ID required'),
  playbookId: PlaybookIdSchema,
});

export type Playbook = z.infer<typeof PlaybookSchema>;
export type CreatePlaybookInput = z.infer<typeof CreatePlaybookSchema>;
export type UpdatePlaybookInput = z.infer<typeof UpdatePlaybookSchema>;
export type AgentRegisterPlaybookInput = z.infer<typeof AgentRegisterPlaybookSchema>;
export type AgentUpdatePlaybookInput = z.infer<typeof AgentUpdatePlaybookSchema>;
export type DashboardRegisterPlaybookInput = z.infer<typeof DashboardRegisterPlaybookSchema>;
export type DashboardUpdatePlaybookInput = z.infer<typeof DashboardUpdatePlaybookSchema>;
export type DeckPlaybook = z.infer<typeof DeckPlaybookSchema>;
export type AddPlaybookToDeckInput = z.infer<typeof AddPlaybookToDeckSchema>;
export type RemovePlaybookFromDeckInput = z.infer<typeof RemovePlaybookFromDeckSchema>;

export type PlaybookSummary = Pick<Playbook, 'id' | 'title' | 'triggers'>;

export type PlaybookDependencyRef = {
  id: string;
  label: string;
};

export type PlaybookDependencies = {
  credentials: PlaybookDependencyRef[];
  services: PlaybookDependencyRef[];
  missingCredentialIds: string[];
  missingServiceIds: string[];
};

export type PlaybookWithDependencies = Playbook & {
  dependencies: PlaybookDependencies;
};

export type PlaybookDependent = {
  id: string;
  title: string;
};
