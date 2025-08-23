import { z } from 'zod';

export const OAuthConfigSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  clientSecret: z.string().min(1, 'Client secret is required'),
  authorizationUrl: z.string().url('Valid authorization URL required'),
  tokenUrl: z.string().url('Valid token URL required'),
  redirectUri: z.string().url('Valid redirect URI required'),
  scope: z.string().min(1, 'Scope is required'),
});

export const OAuthTokenSchema = z.object({
  accessToken: z.string().min(1, 'Access token is required'),
  refreshToken: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  tokenType: z.string().default('Bearer'),
  scope: z.string().optional(),
});

export const OAuthFlowInputSchema = z.object({
  serviceId: z.string().uuid('Valid service ID required'),
  redirectUri: z.string().url('Valid redirect URI required'),
});

export const OAuthCallbackInputSchema = z.object({
  serviceId: z.string().uuid('Valid service ID required'),
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'State parameter is required'),
});

export const OAuthRefreshInputSchema = z.object({
  serviceId: z.string().uuid('Valid service ID required'),
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type OAuthConfig = z.infer<typeof OAuthConfigSchema>;
export type OAuthToken = z.infer<typeof OAuthTokenSchema>;
export type OAuthFlowInput = z.infer<typeof OAuthFlowInputSchema>;
export type OAuthCallbackInput = z.infer<typeof OAuthCallbackInputSchema>;
export type OAuthRefreshInput = z.infer<typeof OAuthRefreshInputSchema>;
