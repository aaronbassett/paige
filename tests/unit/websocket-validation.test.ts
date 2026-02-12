// Unit tests for WebSocket message validation
// Ensures runtime validation catches malformed payloads

import { describe, it, expect } from 'vitest';
import { validateClientMessage } from '../../src/websocket/schemas.js';
import { ZodError } from 'zod';

describe('validateClientMessage', () => {
  describe('envelope validation', () => {
    it('should reject non-object messages', () => {
      expect(() => validateClientMessage('not an object')).toThrow(ZodError);
      expect(() => validateClientMessage(null)).toThrow(ZodError);
      expect(() => validateClientMessage(42)).toThrow(ZodError);
    });

    it('should reject messages without type field', () => {
      expect(() => validateClientMessage({ data: {} })).toThrow(ZodError);
    });

    it('should reject messages without data field', () => {
      // All messages must have a data field, even for unknown types
      expect(() => validateClientMessage({ type: 'test' })).toThrow();
    });

    it('should reject messages with non-string type', () => {
      expect(() => validateClientMessage({ type: 42, data: {} })).toThrow(ZodError);
    });
  });

  describe('data payload validation', () => {
    it('should validate connection:hello with correct schema', () => {
      const validMessage = {
        type: 'connection:hello',
        data: {
          version: '1.0.0',
          platform: 'darwin',
          windowSize: { width: 1920, height: 1080 },
        },
      };

      const result = validateClientMessage(validMessage);
      expect(result.type).toBe('connection:hello');
      expect(result.data).toEqual(validMessage.data);
    });

    it('should reject connection:hello with missing fields', () => {
      const invalidMessage = {
        type: 'connection:hello',
        data: {
          version: '1.0.0',
          // Missing platform and windowSize
        },
      };

      expect(() => validateClientMessage(invalidMessage)).toThrow(ZodError);
    });

    it('should reject connection:hello with wrong field types', () => {
      const invalidMessage = {
        type: 'connection:hello',
        data: {
          version: 123, // Should be string
          platform: 'darwin',
          windowSize: { width: 1920, height: 1080 },
        },
      };

      expect(() => validateClientMessage(invalidMessage)).toThrow(ZodError);
    });

    it('should validate file:open with correct schema', () => {
      const validMessage = {
        type: 'file:open',
        data: { path: '/path/to/file.ts' },
      };

      const result = validateClientMessage(validMessage);
      expect(result.type).toBe('file:open');
      expect(result.data).toEqual({ path: '/path/to/file.ts' });
    });

    it('should reject file:open with missing path', () => {
      const invalidMessage = {
        type: 'file:open',
        data: {},
      };

      expect(() => validateClientMessage(invalidMessage)).toThrow(ZodError);
    });

    it('should validate buffer:update with correct schema', () => {
      const validMessage = {
        type: 'buffer:update',
        data: {
          path: '/path/to/file.ts',
          content: 'const x = 1;',
          cursorPosition: 12,
          selections: [{ start: 0, end: 5 }],
        },
      };

      const result = validateClientMessage(validMessage);
      expect(result.type).toBe('buffer:update');
      expect(result.data).toEqual(validMessage.data);
    });

    it('should reject buffer:update with invalid selections array', () => {
      const invalidMessage = {
        type: 'buffer:update',
        data: {
          path: '/path/to/file.ts',
          content: 'const x = 1;',
          cursorPosition: 12,
          selections: [{ start: 0 }], // Missing 'end'
        },
      };

      expect(() => validateClientMessage(invalidMessage)).toThrow(ZodError);
    });

    it('should validate hints:level_change with correct schema', () => {
      const validMessage = {
        type: 'hints:level_change',
        data: {
          from: 'low',
          to: 'medium',
        },
      };

      const result = validateClientMessage(validMessage);
      expect(result.type).toBe('hints:level_change');
      expect(result.data).toEqual({ from: 'low', to: 'medium' });
    });

    it('should reject hints:level_change with invalid enum values', () => {
      const invalidMessage = {
        type: 'hints:level_change',
        data: {
          from: 'invalid',
          to: 'medium',
        },
      };

      expect(() => validateClientMessage(invalidMessage)).toThrow(ZodError);
    });
  });

  describe('unknown message types', () => {
    it('should allow unknown message types to pass through', () => {
      const unknownMessage = {
        type: 'unknown:type',
        data: { anything: 'goes' },
      };

      // Unknown types should pass envelope validation
      // The router will handle them with NOT_IMPLEMENTED
      const result = validateClientMessage(unknownMessage);
      expect(result.type).toBe('unknown:type');
    });
  });

  describe('nested validation errors', () => {
    it('should catch nested object validation errors', () => {
      const invalidMessage = {
        type: 'connection:hello',
        data: {
          version: '1.0.0',
          platform: 'darwin',
          windowSize: {
            width: '1920', // Should be number, not string
            height: 1080,
          },
        },
      };

      expect(() => validateClientMessage(invalidMessage)).toThrow(ZodError);
    });

    it('should catch array element validation errors', () => {
      const invalidMessage = {
        type: 'buffer:update',
        data: {
          path: '/path/to/file.ts',
          content: 'const x = 1;',
          cursorPosition: 12,
          selections: [
            { start: 0, end: 5 },
            { start: 10, end: 'invalid' }, // Invalid 'end' type
          ],
        },
      };

      expect(() => validateClientMessage(invalidMessage)).toThrow(ZodError);
    });
  });
});
