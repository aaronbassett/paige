import { describe, it, expect, beforeEach } from 'vitest';
import {
  getBuffer,
  updateBuffer,
  markClean,
  removeBuffer,
  clearAll,
  getDirtyPaths,
  type CursorPosition,
} from '../../src/file-system/buffer-cache.js';

/**
 * Integration tests for the in-memory buffer cache (FR-027 through FR-030).
 *
 * These tests exercise the real buffer cache module with no mocking.
 * The buffer cache is a Map<string, BufferEntry> that tracks open file
 * contents, cursor positions, and dirty state.
 *
 * Written TDD-style: these tests MUST fail until the buffer cache
 * implementation replaces the current stubs.
 */

describe('Buffer Cache', () => {
  const testPath = '/tmp/test-project/src/index.ts';
  const testContent = 'console.log("hello");';
  const testCursor: CursorPosition = { line: 1, column: 22 };

  beforeEach(() => {
    clearAll();
  });

  // ── getBuffer ────────────────────────────────────────────────────────────

  describe('getBuffer', () => {
    it('returns null for an unknown path', () => {
      const result = getBuffer('/nonexistent/file.ts');

      expect(result).toBeNull();
    });

    it('returns the buffer entry after an update', () => {
      updateBuffer(testPath, testContent, testCursor);

      const entry = getBuffer(testPath);

      expect(entry).not.toBeNull();
      expect(entry!.content).toBe(testContent);
      expect(entry!.cursorPosition).toEqual(testCursor);
    });
  });

  // ── updateBuffer ─────────────────────────────────────────────────────────

  describe('updateBuffer', () => {
    it('creates a new entry with dirty: true', () => {
      updateBuffer(testPath, testContent, testCursor);

      const entry = getBuffer(testPath);

      expect(entry).not.toBeNull();
      expect(entry!.dirty).toBe(true);
    });

    it('sets content and cursorPosition correctly', () => {
      const cursor: CursorPosition = { line: 10, column: 5 };
      const content = 'function add(a: number, b: number): number { return a + b; }';

      updateBuffer(testPath, content, cursor);

      const entry = getBuffer(testPath);

      expect(entry).not.toBeNull();
      expect(entry!.content).toBe(content);
      expect(entry!.cursorPosition.line).toBe(10);
      expect(entry!.cursorPosition.column).toBe(5);
    });

    it('sets lastUpdated to a valid ISO 8601 timestamp', () => {
      const before = new Date().toISOString();

      updateBuffer(testPath, testContent, testCursor);

      const after = new Date().toISOString();
      const entry = getBuffer(testPath);

      expect(entry).not.toBeNull();

      // Verify it parses as a valid date
      const parsed = new Date(entry!.lastUpdated);
      expect(parsed.toString()).not.toBe('Invalid Date');

      // Verify the timestamp is between before and after (inclusive)
      expect(entry!.lastUpdated >= before).toBe(true);
      expect(entry!.lastUpdated <= after).toBe(true);
    });

    it('overwrites existing entry on repeated updates', () => {
      updateBuffer(testPath, 'first version', { line: 1, column: 1 });
      updateBuffer(testPath, 'second version', { line: 2, column: 10 });

      const entry = getBuffer(testPath);

      expect(entry).not.toBeNull();
      expect(entry!.content).toBe('second version');
      expect(entry!.cursorPosition).toEqual({ line: 2, column: 10 });
    });

    it('re-marks a clean buffer as dirty on update', () => {
      updateBuffer(testPath, testContent, testCursor);
      markClean(testPath);

      const cleanEntry = getBuffer(testPath);
      expect(cleanEntry!.dirty).toBe(false);

      // Update again -- should become dirty
      updateBuffer(testPath, 'modified content', testCursor);

      const dirtyEntry = getBuffer(testPath);
      expect(dirtyEntry!.dirty).toBe(true);
    });

    it('handles empty string content', () => {
      updateBuffer(testPath, '', { line: 0, column: 0 });

      const entry = getBuffer(testPath);

      expect(entry).not.toBeNull();
      expect(entry!.content).toBe('');
    });
  });

  // ── markClean ────────────────────────────────────────────────────────────

  describe('markClean', () => {
    it('sets dirty to false for a dirty buffer', () => {
      updateBuffer(testPath, testContent, testCursor);

      // Verify initially dirty
      expect(getBuffer(testPath)!.dirty).toBe(true);

      markClean(testPath);

      expect(getBuffer(testPath)!.dirty).toBe(false);
    });

    it('does not throw when called on a non-existent path', () => {
      // Should be a no-op, not an error
      expect(() => markClean('/nonexistent/file.ts')).not.toThrow();
    });

    it('preserves other entry fields when marking clean', () => {
      updateBuffer(testPath, testContent, testCursor);

      const beforeClean = getBuffer(testPath)!;
      markClean(testPath);
      const afterClean = getBuffer(testPath)!;

      expect(afterClean.content).toBe(beforeClean.content);
      expect(afterClean.cursorPosition).toEqual(beforeClean.cursorPosition);
      expect(afterClean.lastUpdated).toBe(beforeClean.lastUpdated);
    });
  });

  // ── removeBuffer ─────────────────────────────────────────────────────────

  describe('removeBuffer', () => {
    it('removes an existing buffer entry', () => {
      updateBuffer(testPath, testContent, testCursor);
      expect(getBuffer(testPath)).not.toBeNull();

      removeBuffer(testPath);

      expect(getBuffer(testPath)).toBeNull();
    });

    it('does not throw when called on a non-existent path', () => {
      expect(() => removeBuffer('/nonexistent/file.ts')).not.toThrow();
    });

    it('does not affect other buffer entries', () => {
      const otherPath = '/tmp/test-project/src/other.ts';
      updateBuffer(testPath, testContent, testCursor);
      updateBuffer(otherPath, 'other content', { line: 1, column: 1 });

      removeBuffer(testPath);

      expect(getBuffer(testPath)).toBeNull();
      expect(getBuffer(otherPath)).not.toBeNull();
      expect(getBuffer(otherPath)!.content).toBe('other content');
    });
  });

  // ── clearAll ─────────────────────────────────────────────────────────────

  describe('clearAll', () => {
    it('removes all buffer entries', () => {
      updateBuffer('/tmp/a.ts', 'a', { line: 1, column: 1 });
      updateBuffer('/tmp/b.ts', 'b', { line: 2, column: 2 });
      updateBuffer('/tmp/c.ts', 'c', { line: 3, column: 3 });

      clearAll();

      expect(getBuffer('/tmp/a.ts')).toBeNull();
      expect(getBuffer('/tmp/b.ts')).toBeNull();
      expect(getBuffer('/tmp/c.ts')).toBeNull();
    });

    it('results in empty dirty paths', () => {
      updateBuffer('/tmp/a.ts', 'a', { line: 1, column: 1 });
      updateBuffer('/tmp/b.ts', 'b', { line: 2, column: 2 });

      clearAll();

      expect(getDirtyPaths()).toEqual([]);
    });

    it('does not throw when cache is already empty', () => {
      expect(() => clearAll()).not.toThrow();
    });
  });

  // ── getDirtyPaths ────────────────────────────────────────────────────────

  describe('getDirtyPaths', () => {
    it('returns empty array when no buffers exist', () => {
      const result = getDirtyPaths();

      expect(result).toEqual([]);
    });

    it('returns paths of dirty buffers only', () => {
      updateBuffer('/tmp/dirty1.ts', 'dirty1', { line: 1, column: 1 });
      updateBuffer('/tmp/dirty2.ts', 'dirty2', { line: 2, column: 2 });
      updateBuffer('/tmp/clean.ts', 'clean', { line: 3, column: 3 });

      // Mark one as clean
      markClean('/tmp/clean.ts');

      const dirtyPaths = getDirtyPaths();

      expect(dirtyPaths).toHaveLength(2);
      expect(dirtyPaths).toContain('/tmp/dirty1.ts');
      expect(dirtyPaths).toContain('/tmp/dirty2.ts');
      expect(dirtyPaths).not.toContain('/tmp/clean.ts');
    });

    it('returns empty array when all buffers are clean', () => {
      updateBuffer('/tmp/a.ts', 'a', { line: 1, column: 1 });
      updateBuffer('/tmp/b.ts', 'b', { line: 2, column: 2 });

      markClean('/tmp/a.ts');
      markClean('/tmp/b.ts');

      expect(getDirtyPaths()).toEqual([]);
    });

    it('includes a path again after re-dirtying a cleaned buffer', () => {
      updateBuffer(testPath, testContent, testCursor);
      markClean(testPath);

      expect(getDirtyPaths()).toEqual([]);

      // Re-dirty the buffer
      updateBuffer(testPath, 'modified', testCursor);

      expect(getDirtyPaths()).toContain(testPath);
    });
  });

  // ── lastUpdated ISO 8601 validation ──────────────────────────────────────

  describe('lastUpdated timestamp', () => {
    it('is a valid ISO 8601 string', () => {
      updateBuffer(testPath, testContent, testCursor);

      const entry = getBuffer(testPath);
      expect(entry).not.toBeNull();

      // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
      expect(entry!.lastUpdated).toMatch(iso8601Regex);
    });

    it('updates the timestamp on subsequent writes', async () => {
      updateBuffer(testPath, 'first', testCursor);
      const firstTimestamp = getBuffer(testPath)!.lastUpdated;

      // Small delay to ensure timestamp changes
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 10);
      });

      updateBuffer(testPath, 'second', testCursor);
      const secondTimestamp = getBuffer(testPath)!.lastUpdated;

      expect(secondTimestamp >= firstTimestamp).toBe(true);
    });
  });
});
