import { z } from 'zod';

export const PolarityHintSchema = z.enum(['negative', 'positive', 'mixed', 'unknown']);

export const OutcomeSignalSchema = z.enum(['pr_opened', 'committed', 'unknown']);

export const FeedbackMomentSchema = z
  .object({
    agentAction: z.string().max(400),
    userReaction: z.string().max(600),
    polarityHint: PolarityHintSchema,
    markers: z.array(z.string()),
    followupChange: z.string().max(400).nullable().optional(),
    at: z.string().datetime().optional(),
  })
  .strict();

export const IntentItemSchema = z
  .object({
    text: z.string().max(280),
    at: z.string().datetime().optional(),
  })
  .strict();

export const CommandItemSchema = z
  .object({
    command: z.string().max(160),
    count: z.number().int().min(1),
  })
  .strict();

export const ToolItemSchema = z
  .object({
    name: z.string(),
    count: z.number().int().min(1),
  })
  .strict();

export const SkillItemSchema = z
  .object({
    name: z.string(),
    count: z.number().int().min(1),
  })
  .strict();

export const TopFileItemSchema = z
  .object({
    path: z.string(),
    edits: z.number().int().min(1),
  })
  .strict();

export const OutcomeSchema = z
  .object({
    signal: OutcomeSignalSchema,
    evidence: z.string().optional(),
  })
  .strict();

export const SessionDigestSchema = z
  .object({
    schemaVersion: z.literal(1),
    sessionId: z.string(),
    workspaceRoot: z.string(),
    workspaceLabel: z.string().optional(),
    gitBranch: z.string().nullable().optional(),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime().optional(),
    durationMinutes: z.number().min(0).optional(),
    turnCount: z.number().int().min(0),
    skippedLineCount: z.number().int().min(0).optional(),
    intents: z.array(IntentItemSchema).max(40),
    commands: z.array(CommandItemSchema).max(40).default([]),
    tools: z.array(ToolItemSchema).max(40).default([]),
    skills: z.array(SkillItemSchema).max(40).default([]),
    topFiles: z.array(TopFileItemSchema).max(20).default([]),
    feedbackMoments: z.array(FeedbackMomentSchema).max(30),
    outcome: OutcomeSchema,
  })
  .strict();

export const BootstrapWorkspaceSchema = z
  .object({
    workspaceRoot: z.string(),
    label: z.string(),
    sessionCount: z.number().int().min(0),
    digestPaths: z.array(z.string()),
  })
  .strict();

export const BootstrapManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    generatedAt: z.string().datetime(),
    digestDir: z.string(),
    guideRef: z.string(),
    totalSessions: z.number().int().min(0),
    workspaces: z.array(BootstrapWorkspaceSchema),
  })
  .strict();

export type PolarityHint = z.infer<typeof PolarityHintSchema>;
export type OutcomeSignal = z.infer<typeof OutcomeSignalSchema>;
export type FeedbackMoment = z.infer<typeof FeedbackMomentSchema>;
export type SessionDigest = z.infer<typeof SessionDigestSchema>;
export type BootstrapManifest = z.infer<typeof BootstrapManifestSchema>;
