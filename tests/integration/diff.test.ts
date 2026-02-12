import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getDiff, readFile, writeFile, validatePath } from '../../src/file-system/file-ops.js';
import { updateBuffer, clearAll as clearBuffers } from '../../src/file-system/buffer-cache.js';

/**
 * Integration tests for diff computation and file operations.
 *
 * Tests FR-031 (getDiff returns unified diff), FR-032 (empty diff when clean),
 * FR-024 (readFile returns content + language), FR-025 (language detection),
 * and writeFile disk persistence.
 *
 * Uses real temp directories and the actual buffer cache — no mocking.
 * Written TDD-style: these tests MUST fail against current stubs.
 */

describe('File operations and diff computation', () => {
  let PROJECT_DIR: string;

  beforeAll(() => {
    PROJECT_DIR = join(tmpdir(), `paige-diff-${randomUUID()}`);
    mkdirSync(PROJECT_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(PROJECT_DIR, { recursive: true, force: true });
  });

  beforeEach(() => {
    clearBuffers();
  });

  // ── readFile ──────────────────────────────────────────────────────

  describe('readFile', () => {
    it('returns content and detected language for .ts file', async () => {
      const filePath = join(PROJECT_DIR, 'example.ts');
      writeFileSync(filePath, 'const x: number = 42;\n', 'utf-8');

      const result = await readFile(filePath, PROJECT_DIR);

      expect(result.content).toBe('const x: number = 42;\n');
      expect(result.language).toBe('typescript');
    });

    it('returns content and detected language for .js file', async () => {
      const filePath = join(PROJECT_DIR, 'example.js');
      writeFileSync(filePath, 'const y = 10;\n', 'utf-8');

      const result = await readFile(filePath, PROJECT_DIR);

      expect(result.content).toBe('const y = 10;\n');
      expect(result.language).toBe('javascript');
    });

    it('rejects path outside PROJECT_DIR', async () => {
      const outsidePath = join(tmpdir(), `outside-${randomUUID()}`, 'secret.ts');

      await expect(readFile(outsidePath, PROJECT_DIR)).rejects.toThrow();
    });
  });

  // ── validatePath ──────────────────────────────────────────────────

  describe('validatePath', () => {
    it('rejects path traversal attempts', () => {
      const maliciousPath = join(PROJECT_DIR, '..', '..', 'etc', 'passwd');

      expect(() => validatePath(maliciousPath, PROJECT_DIR)).toThrow();
    });

    it('accepts valid path within PROJECT_DIR', () => {
      const validPath = join(PROJECT_DIR, 'src', 'index.ts');

      const resolved = validatePath(validPath, PROJECT_DIR);

      expect(resolved).toBe(validPath);
    });
  });

  // ── writeFile ─────────────────────────────────────────────────────

  describe('writeFile', () => {
    it('writes content to disk', async () => {
      const filePath = join(PROJECT_DIR, 'output.ts');
      const content = 'export const answer = 42;\n';

      await writeFile(filePath, content, PROJECT_DIR);

      const ondisk = readFileSync(filePath, 'utf-8');
      expect(ondisk).toBe(content);
    });

    it('creates parent directories if needed', async () => {
      const filePath = join(PROJECT_DIR, 'nested', 'deep', 'file.ts');
      const content = 'export {};\n';

      await writeFile(filePath, content, PROJECT_DIR);

      const ondisk = readFileSync(filePath, 'utf-8');
      expect(ondisk).toBe(content);
    });
  });

  // ── getDiff ───────────────────────────────────────────────────────

  describe('getDiff', () => {
    it('returns empty string when no buffer exists', async () => {
      const filePath = join(PROJECT_DIR, 'no-buffer.ts');
      writeFileSync(filePath, 'original content\n', 'utf-8');

      const diff = await getDiff(filePath, PROJECT_DIR);

      expect(diff).toBe('');
    });

    it('returns empty string when buffer is clean (not dirty)', async () => {
      const filePath = join(PROJECT_DIR, 'clean-buffer.ts');
      const content = 'clean content\n';
      writeFileSync(filePath, content, 'utf-8');

      // Update buffer with identical content, then the buffer should be dirty
      // because updateBuffer always sets dirty: true. But we want a clean buffer,
      // so we simulate writeFile which marks it clean.
      // Instead, we rely on the fact that getDiff checks dirty flag.
      // The simplest approach: update buffer then mark clean via writeFile.
      updateBuffer(filePath, content, { line: 1, column: 1 });

      // writeFile should mark buffer as clean
      await writeFile(filePath, content, PROJECT_DIR);

      const diff = await getDiff(filePath, PROJECT_DIR);

      expect(diff).toBe('');
    });

    it('returns unified diff when buffer is dirty with changes', async () => {
      const filePath = join(PROJECT_DIR, 'dirty-buffer.ts');
      writeFileSync(filePath, 'const a = 1;\n', 'utf-8');

      // Simulate editing: update buffer with modified content
      updateBuffer(filePath, 'const a = 2;\n', { line: 1, column: 1 });

      const diff = await getDiff(filePath, PROJECT_DIR);

      // Should be a non-empty unified diff string
      expect(diff).not.toBe('');
      // Unified diff format starts with --- and +++
      expect(diff).toContain('---');
      expect(diff).toContain('+++');
    });

    it('includes added and removed lines in unified format', async () => {
      const filePath = join(PROJECT_DIR, 'add-remove.ts');
      const original = 'line one\nline two\nline three\n';
      const modified = 'line one\nline TWO modified\nline three\nnew line four\n';
      writeFileSync(filePath, original, 'utf-8');

      updateBuffer(filePath, modified, { line: 1, column: 1 });

      const diff = await getDiff(filePath, PROJECT_DIR);

      // Removed line should be prefixed with -
      expect(diff).toContain('-line two');
      // Added/modified line should be prefixed with +
      expect(diff).toContain('+line TWO modified');
      // Newly added line
      expect(diff).toContain('+new line four');
    });
  });
});
