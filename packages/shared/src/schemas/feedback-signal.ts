import { z } from 'zod';
import { PatchEvidenceSchema } from './playbook-patch';

export const FeedbackSignalIdSchema = z
  .string()
  .regex(/^fs_[a-z0-9_]+$/, 'Signal id must match fs_<slug>');

export const FeedbackSignalSourceSchema = z.enum(['ide', 'dealer', 'backfill']);

export const FeedbackSignalStatusSchema = z.enum(['unreviewed', 'actioned', 'discarded']);

export const FeedbackSignalSchema = z.object({
  id: FeedbackSignalIdSchema,
  source: FeedbackSignalSourceSchema,
  sourceRef: z.string().nullable(),
  failureSummary: z.string().min(1),
  userFeedbackExcerpt: z.string().min(1),
  correctedOutputHint: z.string().nullable(),
  candidatePlaybookId: z.string().nullable(),
  candidateDeckId: z.string().uuid().nullable(),
  linkedPatchId: z.string().nullable(),
  status: FeedbackSignalStatusSchema,
  createdAt: z.string(),
});

export type FeedbackSignal = z.infer<typeof FeedbackSignalSchema>;
export type FeedbackSignalSource = z.infer<typeof FeedbackSignalSourceSchema>;
export type FeedbackSignalStatus = z.infer<typeof FeedbackSignalStatusSchema>;

export const FeedbackSignalCountSchema = z.object({
  unreviewed: z.number().int().nonnegative(),
});

export type FeedbackSignalCount = z.infer<typeof FeedbackSignalCountSchema>;

export const ListFeedbackSignalsQuerySchema = z.object({
  status: FeedbackSignalStatusSchema.optional(),
  playbookId: z.string().optional(),
  deckId: z.string().uuid().optional(),
});

export type ListFeedbackSignalsQuery = z.infer<typeof ListFeedbackSignalsQuerySchema>;

export const DiscardFeedbackSignalsSchema = z.object({
  signalIds: z.array(FeedbackSignalIdSchema).min(1),
});

export type DiscardFeedbackSignalsInput = z.infer<typeof DiscardFeedbackSignalsSchema>;

export const DiscardFeedbackSignalsResultSchema = z.object({
  discarded: z.number().int().nonnegative(),
  ids: z.array(FeedbackSignalIdSchema),
});

export type DiscardFeedbackSignalsResult = z.infer<typeof DiscardFeedbackSignalsResultSchema>;

export const ImportFeedbackSignalItemSchema = z.object({
  source: z.literal('backfill').default('backfill'),
  sourceRef: z.string().nullable().optional(),
  failureSummary: z.string().min(1),
  userFeedbackExcerpt: z.string().min(1),
  correctedOutputHint: z.string().nullable().optional(),
  candidatePlaybookId: z.string().nullable().optional(),
  candidateDeckId: z.string().uuid().nullable().optional(),
});

export const ImportFeedbackSignalsSchema = z.object({
  signals: z.array(ImportFeedbackSignalItemSchema).min(1),
});

export type ImportFeedbackSignalItem = z.infer<typeof ImportFeedbackSignalItemSchema>;
export type ImportFeedbackSignalsInput = z.infer<typeof ImportFeedbackSignalsSchema>;

export const ImportFeedbackSignalsResultSchema = z.object({
  inserted: z.number().int().nonnegative(),
  errors: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      error: z.string(),
    }),
  ),
  ids: z.array(FeedbackSignalIdSchema),
});

export type ImportFeedbackSignalsResult = z.infer<typeof ImportFeedbackSignalsResultSchema>;

/** Evidence required for signal capture (shared with patch evidence shape). */
export const SignalEvidenceSchema = PatchEvidenceSchema;
