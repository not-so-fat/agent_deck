import { z } from 'zod';

export const CredentialIdSchema = z
  .string()
  .regex(/^cred_[a-z0-9_]+$/, 'Credential id must match cred_<slug> (lowercase letters, numbers, underscores)');

export const CredentialSchemeSchema = z.enum(['bearer', 'header', 'http_basic_user']);

export const CredentialSchema = z.object({
  id: CredentialIdSchema,
  label: z.string().min(1, 'Label is required'),
  scheme: CredentialSchemeSchema,
  headerName: z.string().optional(),
  envName: z
    .string()
    .regex(/^[A-Z_][A-Z0-9_]*$/, 'env_name must be a valid environment variable name'),
  keychainAccount: z.string().min(1),
  tags: z.array(z.string()).default([]),
  docsUrl: z.string().url().optional(),
  iconUrl: z.string().optional(),
  hasSecret: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/** Full create payload (used after defaults are applied). */
export const CreateCredentialSchema = z
  .object({
    id: CredentialIdSchema,
    label: z.string().min(1, 'Label is required'),
    scheme: CredentialSchemeSchema.default('bearer'),
    headerName: z.string().optional(),
    envName: z
      .string()
      .regex(/^[A-Z_][A-Z0-9_]*$/, 'env_name must be a valid environment variable name'),
    keychainAccount: z.string().min(1).optional(),
    tags: z.array(z.string()).default([]),
    docsUrl: z.string().url().optional(),
    value: z.string().min(1, 'Secret value is required'),
  })
  .superRefine((data, ctx) => {
    if (data.scheme === 'header' && !data.headerName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'headerName is required when scheme is header',
        path: ['headerName'],
      });
    }
  });

/** Minimal UI / human input — name + secret only. */
export const CreateCredentialSimpleSchema = z.object({
  label: z.string().min(1, 'Name is required'),
  value: z.string().min(1, 'API key is required'),
  docsUrl: z.string().url().optional(),
});

export type CreateCredentialSimpleInput = z.infer<typeof CreateCredentialSimpleSchema>;

export const UpdateCredentialSchema = z.object({
  label: z.string().min(1).optional(),
  scheme: CredentialSchemeSchema.optional(),
  headerName: z.string().optional(),
  envName: z
    .string()
    .regex(/^[A-Z_][A-Z0-9_]*$/)
    .optional(),
  tags: z.array(z.string()).optional(),
  docsUrl: z.union([z.string().url(), z.literal('')]).optional(),
});

export const RotateCredentialSchema = z.object({
  value: z.string().min(1, 'Secret value is required'),
});

export const DeckCredentialSchema = z.object({
  deckId: z.string().uuid('Valid deck ID required'),
  credentialId: CredentialIdSchema,
  position: z.number().int().min(0, 'Position must be non-negative'),
});

export const AddCredentialToDeckSchema = DeckCredentialSchema.omit({
  position: true,
}).extend({
  position: z.number().int().min(0).optional(),
});

export const RemoveCredentialFromDeckSchema = z.object({
  deckId: z.string().uuid('Valid deck ID required'),
  credentialId: CredentialIdSchema,
});

export const ExecRunSchema = z.object({
  id: z.string().uuid(),
  deckId: z.string().uuid().optional(),
  manifestPath: z.string().optional(),
  command: z.string(),
  credentialIds: z.array(CredentialIdSchema),
  exitCode: z.number().int().optional(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().optional(),
});

export type Credential = z.infer<typeof CredentialSchema>;
export type CreateCredentialInput = z.infer<typeof CreateCredentialSchema>;
export type UpdateCredentialInput = z.infer<typeof UpdateCredentialSchema>;
export type RotateCredentialInput = z.infer<typeof RotateCredentialSchema>;
export type DeckCredential = z.infer<typeof DeckCredentialSchema>;
export type AddCredentialToDeckInput = z.infer<typeof AddCredentialToDeckSchema>;
export type RemoveCredentialFromDeckInput = z.infer<typeof RemoveCredentialFromDeckSchema>;
export type ExecRun = z.infer<typeof ExecRunSchema>;
