import { describe, it, expect } from 'vitest';
import { 
  ServiceSchema, 
  CreateServiceSchema, 
  UpdateServiceSchema,
  ServiceCallSchema,
  ServiceToolSchema 
} from './service';

describe('Service Schemas', () => {
  describe('ServiceSchema', () => {
    it('should validate a complete service', () => {
      const validService = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Service',
        type: 'mcp' as const,
        url: 'https://example.com',
        health: 'healthy' as const,
        description: 'A test service',
        cardColor: '#ff0000',
        isConnected: true,
        lastPing: '2023-01-01T00:00:00Z',
        registeredAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        headers: { 'Authorization': 'Bearer token' },
        oauthClientId: 'client123',
        oauthClientSecret: 'secret123',
        oauthAuthorizationUrl: 'https://example.com/oauth/authorize',
        oauthTokenUrl: 'https://example.com/oauth/token',
        oauthRedirectUri: 'https://example.com/callback',
        oauthScope: 'read write',
        oauthAccessToken: 'access_token',
        oauthRefreshToken: 'refresh_token',
        oauthTokenExpiresAt: '2023-01-01T00:00:00Z',
        oauthState: 'state123',
      };

      const result = ServiceSchema.safeParse(validService);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const invalidService = {
        id: 'not-a-uuid',
        name: 'Test Service',
        type: 'mcp' as const,
        url: 'https://example.com',
        registeredAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      const result = ServiceSchema.safeParse(invalidService);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('id');
      }
    });

    it('should reject invalid URL', () => {
      const invalidService = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Service',
        type: 'mcp' as const,
        url: 'not-a-url',
        registeredAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      const result = ServiceSchema.safeParse(invalidService);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('url');
      }
    });

    it('should reject invalid hex color', () => {
      const invalidService = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Service',
        type: 'mcp' as const,
        url: 'https://example.com',
        cardColor: 'not-a-color',
        registeredAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      const result = ServiceSchema.safeParse(invalidService);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('cardColor');
      }
    });
  });

  describe('CreateServiceSchema', () => {
    it('should validate create service input', () => {
      const validInput = {
        name: 'Test Service',
        type: 'mcp' as const,
        url: 'https://example.com',
        description: 'A test service',
        cardColor: '#ff0000',
        headers: { 'Authorization': 'Bearer token' },
        oauthClientId: 'client123',
        oauthClientSecret: 'secret123',
        oauthAuthorizationUrl: 'https://example.com/oauth/authorize',
        oauthTokenUrl: 'https://example.com/oauth/token',
        oauthRedirectUri: 'https://example.com/callback',
        oauthScope: 'read write',
      };

      const result = CreateServiceSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const invalidInput = {
        name: 'Test Service',
        // missing type and url
      };

      const result = CreateServiceSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateServiceSchema', () => {
    it('should validate partial update input', () => {
      const validInput = {
        name: 'Updated Service',
        description: 'Updated description',
      };

      const result = UpdateServiceSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should allow empty object', () => {
      const result = UpdateServiceSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('ServiceCallSchema', () => {
    it('should validate service call input', () => {
      const validInput = {
        serviceId: '123e4567-e89b-12d3-a456-426614174000',
        toolName: 'testTool',
        arguments: { param1: 'value1', param2: 123 },
      };

      const result = ServiceCallSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject invalid service ID', () => {
      const invalidInput = {
        serviceId: 'not-a-uuid',
        toolName: 'testTool',
      };

      const result = ServiceCallSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject empty tool name', () => {
      const invalidInput = {
        serviceId: '123e4567-e89b-12d3-a456-426614174000',
        toolName: '',
      };

      const result = ServiceCallSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('ServiceToolSchema', () => {
    it('should validate service tool', () => {
      const validTool = {
        name: 'testTool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {
            param1: { type: 'string' },
            param2: { type: 'number' },
          },
        },
      };

      const result = ServiceToolSchema.safeParse(validTool);
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const invalidTool = {
        name: '',
        description: 'A test tool',
        inputSchema: {},
      };

      const result = ServiceToolSchema.safeParse(invalidTool);
      expect(result.success).toBe(false);
    });

    it('should reject empty description', () => {
      const invalidTool = {
        name: 'testTool',
        description: '',
        inputSchema: {},
      };

      const result = ServiceToolSchema.safeParse(invalidTool);
      expect(result.success).toBe(false);
    });
  });
});
