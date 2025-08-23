import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { formatZodError, isValidUrl, isValidHexColor, sanitizeHeaders } from './validation';

describe('Validation Utilities', () => {
  describe('formatZodError', () => {
    it('should format Zod errors correctly', () => {
      const mockError = new ZodError([
        {
          code: 'invalid_string',
          message: 'Invalid email',
          path: ['email'],
        },
        {
          code: 'too_small',
          message: 'Name is too short',
          path: ['name'],
        },
      ]);

      const formatted = formatZodError(mockError);
      expect(formatted).toContain('email: Invalid email');
      expect(formatted).toContain('name: Name is too short');
    });

    it('should handle empty error array', () => {
      const mockError = new ZodError([]);
      const formatted = formatZodError(mockError);
      expect(formatted).toBe('');
    });
  });

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://localhost:3000',
        'https://api.github.com/users/123',
        'http://127.0.0.1:8000',
        'https://example.com/path?param=value#fragment',
      ];

      validUrls.forEach(url => {
        expect(isValidUrl(url)).toBe(true);
      });
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'just text',
        '',
        'http://',
        'https://',
        '://example.com',
        'example.com',
        'ftp://', // incomplete protocol
        'http://invalid:port', // invalid port
      ];

      invalidUrls.forEach(url => {
        expect(isValidUrl(url)).toBe(false);
      });
    });
  });

  describe('isValidHexColor', () => {
    it('should validate correct hex colors', () => {
      const validColors = [
        '#ff0000',
        '#00ff00',
        '#0000ff',
        '#ffffff',
        '#000000',
        '#7ed4da',
        '#123456',
        '#abcdef',
      ];

      validColors.forEach(color => {
        expect(isValidHexColor(color)).toBe(true);
      });
    });

    it('should reject invalid hex colors', () => {
      const invalidColors = [
        '#ff000', // too short
        '#ff00000', // too long
        '#ff000g', // invalid character
        'ff0000', // missing #
        '#ff000', // 5 characters
        '#ff00000', // 8 characters
        '',
        'red',
        '#gggggg',
      ];

      invalidColors.forEach(color => {
        expect(isValidHexColor(color)).toBe(false);
      });
    });
  });

  describe('sanitizeHeaders', () => {
    it('should sanitize headers correctly', () => {
      const input = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token',
        'User-Agent': '  test-agent  ',
        'empty': '',
        'null': null,
        'undefined': undefined,
        'number': 123,
        'boolean': true,
      };

      const expected = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token',
        'User-Agent': 'test-agent',
      };

      expect(sanitizeHeaders(input)).toEqual(expected);
    });

    it('should handle empty object', () => {
      expect(sanitizeHeaders({})).toEqual({});
    });

    it('should handle object with only invalid values', () => {
      const input = {
        'empty': '',
        'null': null,
        'undefined': undefined,
        'number': 123,
        'boolean': true,
      };

      expect(sanitizeHeaders(input)).toEqual({});
    });
  });
});
