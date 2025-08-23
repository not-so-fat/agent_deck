import { z } from 'zod';

export const DeckSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Deck name is required'),
  description: z.string().optional(),
  isActive: z.boolean().default(false),
  services: z.array(z.any()).default([]), // Will be populated with Service objects
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateDeckSchema = DeckSchema.omit({
  id: true,
  services: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateDeckSchema = CreateDeckSchema.partial();

export const DeckServiceSchema = z.object({
  deckId: z.string().uuid('Valid deck ID required'),
  serviceId: z.string().uuid('Valid service ID required'),
  position: z.number().int().min(0, 'Position must be non-negative'),
});

export const AddServiceToDeckSchema = DeckServiceSchema.omit({
  position: true,
}).extend({
  position: z.number().int().min(0).optional(),
});

export const RemoveServiceFromDeckSchema = z.object({
  deckId: z.string().uuid('Valid deck ID required'),
  serviceId: z.string().uuid('Valid service ID required'),
});

export const ReorderDeckServicesSchema = z.object({
  deckId: z.string().uuid('Valid deck ID required'),
  serviceIds: z.array(z.string().uuid('Valid service ID required')).min(1, 'At least one service ID required'),
});

export type Deck = z.infer<typeof DeckSchema>;
export type CreateDeckInput = z.infer<typeof CreateDeckSchema>;
export type UpdateDeckInput = z.infer<typeof UpdateDeckSchema>;
export type DeckService = z.infer<typeof DeckServiceSchema>;
export type AddServiceToDeckInput = z.infer<typeof AddServiceToDeckSchema>;
export type RemoveServiceFromDeckInput = z.infer<typeof RemoveServiceFromDeckSchema>;
export type ReorderDeckServicesInput = z.infer<typeof ReorderDeckServicesSchema>;
