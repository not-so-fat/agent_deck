import { z } from 'zod';
import { PlaybookIdSchema } from './playbook';

export const PlaybookPatchIdSchema = z
  .string()
  .regex(/^pp_[a-z0-9_]+$/, 'Patch id must match pp_<slug>');

export const PlaybookPatchKindSchema = z.enum(['create', 'update', 'merge', 'retire']);

export const PlaybookPatchStatusSchema = z.enum(['proposed', 'accepted', 'rejected', 'stale']);

export const PlaybookPatchSourceSchema = z.enum(['ide', 'dealer', 'hook', 'harvester']);

export type PlaybookPatchSource = z.infer<typeof PlaybookPatchSourceSchema>;

export const PatchEvidenceSchema = z.object({
  failure_summary: z.string().min(1),
  user_feedback_excerpt: z.string().min(1),
  corrected_output_hint: z.string().optional(),
});

export const AddItemOpSchema = z.object({
  op: z.literal('add_item'),
  section: z.string().min(1),
  text: z.string().min(1),
});

export const AmendItemOpSchema = z.object({
  op: z.literal('amend_item'),
  section: z.string().min(1),
  anchor: z.string().min(1),
  text: z.string().min(1),
});

export const RemoveItemOpSchema = z.object({
  op: z.literal('remove_item'),
  section: z.string().min(1),
  anchor: z.string().min(1),
});

export const SetTriggersOpSchema = z.object({
  op: z.literal('set_triggers'),
  triggers: z.array(z.string()),
});

export const RewriteBodyOpSchema = z.object({
  op: z.literal('rewrite_body'),
  text: z.string(),
});

export const BodyPatchOpSchema = z.discriminatedUnion('op', [
  AddItemOpSchema,
  AmendItemOpSchema,
  RemoveItemOpSchema,
  RewriteBodyOpSchema,
]);

export const PatchOpSchema = z.discriminatedUnion('op', [
  AddItemOpSchema,
  AmendItemOpSchema,
  RemoveItemOpSchema,
  SetTriggersOpSchema,
  RewriteBodyOpSchema,
]);

export const CreatePlaybookPatchFieldsSchema = z.object({
  title: z.string().min(1),
  body: z.string().default(''),
  triggers: z.array(z.string()).min(1, 'Genesis playbooks need at least one trigger'),
  deck_id: z.string().uuid(),
  exec: z.string().optional(),
  skill: z.string().optional(),
});

export const ProposePlaybookPatchSchema = z.object({
  kind: PlaybookPatchKindSchema,
  playbook_id: PlaybookIdSchema.optional(),
  ops: z.array(PatchOpSchema).optional(),
  new_playbook: CreatePlaybookPatchFieldsSchema.optional(),
  rationale: z.string().min(1),
  evidence: PatchEvidenceSchema.optional(),
});

export const RejectPlaybookPatchSchema = z.object({
  reason: z.string().min(1),
});

export type PatchEvidence = z.infer<typeof PatchEvidenceSchema>;
export type PatchOp = z.infer<typeof PatchOpSchema>;
export type BodyPatchOp = z.infer<typeof BodyPatchOpSchema>;
export type CreatePlaybookPatchFields = z.infer<typeof CreatePlaybookPatchFieldsSchema>;
export type ProposePlaybookPatchInput = z.infer<typeof ProposePlaybookPatchSchema>;

export type PlaybookPatch = {
  id: string;
  kind: z.infer<typeof PlaybookPatchKindSchema>;
  playbookId: string | null;
  opsJson: string;
  rationale: string;
  source: z.infer<typeof PlaybookPatchSourceSchema>;
  sourceRef: string | null;
  evidenceJson: string | null;
  status: z.infer<typeof PlaybookPatchStatusSchema>;
  rejectionReason: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type PlaybookVersion = {
  id: string;
  playbookId: string;
  title: string;
  body: string;
  triggers: string[];
  patchId: string | null;
  actor: 'user' | 'agent';
  createdAt: string;
};

export type PlaybookEvent = {
  id: string;
  playbookId: string;
  event: 'fetched';
  source: string;
  createdAt: string;
};

export type PatchPreview = {
  before: { title: string; body: string; triggers: string[] };
  after: { title: string; body: string; triggers: string[] };
};
