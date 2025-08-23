import { describe, it, expect } from 'vitest';
import { 
  toSnakeCase, 
  toCamelCase, 
  convertToSnakeCase, 
  convertToCamelCase,
  serializeForDatabase,
  deserializeFromDatabase
} from './database';

describe('Database Utilities', () => {
  describe('toSnakeCase', () => {
    it('should convert camelCase to snake_case', () => {
      expect(toSnakeCase('camelCase')).toBe('camel_case');
      expect(toSnakeCase('userName')).toBe('user_name');
      expect(toSnakeCase('firstName')).toBe('first_name');
      expect(toSnakeCase('lastName')).toBe('last_name');
      expect(toSnakeCase('oauthClientId')).toBe('oauth_client_id');
    });

    it('should handle single words', () => {
      expect(toSnakeCase('name')).toBe('name');
      expect(toSnakeCase('id')).toBe('id');
    });

    it('should handle empty string', () => {
      expect(toSnakeCase('')).toBe('');
    });
  });

  describe('toCamelCase', () => {
    it('should convert snake_case to camelCase', () => {
      expect(toCamelCase('snake_case')).toBe('snakeCase');
      expect(toCamelCase('user_name')).toBe('userName');
      expect(toCamelCase('first_name')).toBe('firstName');
      expect(toCamelCase('last_name')).toBe('lastName');
      expect(toCamelCase('oauth_client_id')).toBe('oauthClientId');
    });

    it('should handle single words', () => {
      expect(toCamelCase('name')).toBe('name');
      expect(toCamelCase('id')).toBe('id');
    });

    it('should handle empty string', () => {
      expect(toCamelCase('')).toBe('');
    });
  });

  describe('convertToSnakeCase', () => {
    it('should convert object keys to snake_case', () => {
      const input = {
        userName: 'john',
        firstName: 'John',
        lastName: 'Doe',
        oauthClientId: 'client123',
      };

      const expected = {
        user_name: 'john',
        first_name: 'John',
        last_name: 'Doe',
        oauth_client_id: 'client123',
      };

      expect(convertToSnakeCase(input)).toEqual(expected);
    });

    it('should handle empty object', () => {
      expect(convertToSnakeCase({})).toEqual({});
    });
  });

  describe('convertToCamelCase', () => {
    it('should convert object keys to camelCase', () => {
      const input = {
        user_name: 'john',
        first_name: 'John',
        last_name: 'Doe',
        oauth_client_id: 'client123',
      };

      const expected = {
        userName: 'john',
        firstName: 'John',
        lastName: 'Doe',
        oauthClientId: 'client123',
      };

      expect(convertToCamelCase(input)).toEqual(expected);
    });

    it('should handle empty object', () => {
      expect(convertToCamelCase({})).toEqual({});
    });
  });

  describe('serializeForDatabase', () => {
    it('should serialize object for database storage', () => {
      const input = {
        userName: 'john',
        firstName: 'John',
        lastName: 'Doe',
        metadata: { role: 'admin', permissions: ['read', 'write'] },
        tags: ['tag1', 'tag2'],
        isActive: true,
        createdAt: '2023-01-01T00:00:00Z',
      };

      const result = serializeForDatabase(input);

      expect(result.user_name).toBe('john');
      expect(result.first_name).toBe('John');
      expect(result.last_name).toBe('Doe');
      expect(result.metadata).toBe('{"role":"admin","permissions":["read","write"]}');
      expect(result.tags).toEqual(['tag1', 'tag2']);
      expect(result.is_active).toBe(true);
      expect(result.created_at).toBe('2023-01-01T00:00:00Z');
    });

    it('should skip undefined and null values', () => {
      const input = {
        name: 'test',
        description: undefined,
        metadata: null,
        tags: [],
      };

      const result = serializeForDatabase(input);

      expect(result.name).toBe('test');
      expect(result.tags).toEqual([]);
      expect(result).not.toHaveProperty('description');
      expect(result).not.toHaveProperty('metadata');
    });
  });

  describe('deserializeFromDatabase', () => {
    it('should deserialize object from database', () => {
      const input = {
        user_name: 'john',
        first_name: 'John',
        last_name: 'Doe',
        metadata: '{"role":"admin","permissions":["read","write"]}',
        tags: '["tag1","tag2"]',
        is_active: 1,
        created_at: '2023-01-01T00:00:00Z',
      };

      const result = deserializeFromDatabase(input);

      expect(result.userName).toBe('john');
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
      expect(result.metadata).toEqual({ role: 'admin', permissions: ['read', 'write'] });
      expect(result.tags).toEqual(['tag1', 'tag2']);
      expect(result.isActive).toBe(1);
      expect(result.createdAt).toBe('2023-01-01T00:00:00Z');
    });

    it('should handle non-JSON strings', () => {
      const input = {
        name: 'test',
        description: 'just a string',
        metadata: 'not json',
      };

      const result = deserializeFromDatabase(input);

      expect(result.name).toBe('test');
      expect(result.description).toBe('just a string');
      expect(result.metadata).toBe('not json');
    });

    it('should handle empty object', () => {
      expect(deserializeFromDatabase({})).toEqual({});
    });
  });
});
