import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { validatePath } from '../../../src/file-system/file-ops.js';

describe('validatePath', () => {
  let projectDir: string;

  beforeAll(() => {
    const suffix = randomBytes(8).toString('hex');
    projectDir = mkdtempSync(join(tmpdir(), `paige-security-test-${suffix}-`));

    // Create nested directory structure for testing
    mkdirSync(join(projectDir, 'src'), { recursive: true });
    mkdirSync(join(projectDir, 'src', 'nested'), { recursive: true });
    writeFileSync(join(projectDir, 'README.md'), '# Test');
    writeFileSync(join(projectDir, 'src', 'index.ts'), 'export {};');
    writeFileSync(join(projectDir, 'src', 'nested', 'deep.ts'), 'export {};');
  });

  afterAll(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  // ─── FR-023 / EC-10: Path traversal rejection ───

  describe('path traversal rejection', () => {
    it('rejects ../../etc/passwd', () => {
      expect(() => validatePath('../../etc/passwd', projectDir)).toThrow();
    });

    it('rejects ../.. traversal from nested path', () => {
      expect(() => validatePath('src/../../../etc/shadow', projectDir)).toThrow();
    });

    it('rejects leading .. that escapes project root', () => {
      expect(() => validatePath('../outside-file.txt', projectDir)).toThrow();
    });

    it('includes a descriptive error message on traversal', () => {
      expect(() => validatePath('../../etc/passwd', projectDir)).toThrow(
        /outside.*project|path.*traversal|not.*within|escape/i,
      );
    });
  });

  // ─── EC-11: Absolute paths outside PROJECT_DIR ───

  describe('absolute paths outside PROJECT_DIR', () => {
    it('rejects /etc/passwd', () => {
      expect(() => validatePath('/etc/passwd', projectDir)).toThrow();
    });

    it('rejects /tmp when PROJECT_DIR is not /tmp', () => {
      // projectDir is a subdir of /tmp, so /tmp itself is the parent
      expect(() => validatePath('/tmp', projectDir)).toThrow();
    });

    it('rejects a sibling directory of PROJECT_DIR', () => {
      const sibling = resolve(projectDir, '..', 'sibling-project');
      expect(() => validatePath(sibling, projectDir)).toThrow();
    });

    it('rejects path with PROJECT_DIR as a prefix but not a true parent', () => {
      // e.g., PROJECT_DIR is /tmp/abc, path is /tmp/abc-evil/file.txt
      const evilPath = projectDir + '-evil/file.txt';
      expect(() => validatePath(evilPath, projectDir)).toThrow();
    });
  });

  // ─── EC-11: Symlinks pointing outside PROJECT_DIR ───

  describe('symlink rejection', () => {
    let symlinkPath: string;

    beforeAll(() => {
      // Create a symlink inside projectDir that points outside
      symlinkPath = join(projectDir, 'escape-link');
      symlinkSync('/etc', symlinkPath);
    });

    it('rejects a symlink whose target is outside PROJECT_DIR', () => {
      expect(() => validatePath('escape-link/passwd', projectDir)).toThrow();
    });

    it('rejects a direct symlink to an outside file', () => {
      const fileLink = join(projectDir, 'outside-file-link');
      symlinkSync('/etc/hostname', fileLink);

      expect(() => validatePath('outside-file-link', projectDir)).toThrow();
    });
  });

  // ─── Valid relative paths within PROJECT_DIR ───

  describe('valid relative paths', () => {
    it('resolves a simple filename in the project root', () => {
      const result = validatePath('README.md', projectDir);
      expect(result).toBe(join(projectDir, 'README.md'));
    });

    it('resolves a nested relative path', () => {
      const result = validatePath('src/index.ts', projectDir);
      expect(result).toBe(join(projectDir, 'src', 'index.ts'));
    });

    it('resolves a deeply nested relative path', () => {
      const result = validatePath('src/nested/deep.ts', projectDir);
      expect(result).toBe(join(projectDir, 'src', 'nested', 'deep.ts'));
    });
  });

  // ─── Paths with .. that still resolve within PROJECT_DIR ───

  describe('paths with .. that stay within PROJECT_DIR', () => {
    it('allows src/../README.md (resolves to project root)', () => {
      const result = validatePath('src/../README.md', projectDir);
      expect(result).toBe(join(projectDir, 'README.md'));
    });

    it('allows src/nested/../../README.md', () => {
      const result = validatePath('src/nested/../../README.md', projectDir);
      expect(result).toBe(join(projectDir, 'README.md'));
    });

    it('allows src/nested/../index.ts', () => {
      const result = validatePath('src/nested/../index.ts', projectDir);
      expect(result).toBe(join(projectDir, 'src', 'index.ts'));
    });
  });

  // ─── Valid absolute paths within PROJECT_DIR ───

  describe('valid absolute paths within PROJECT_DIR', () => {
    it('accepts an absolute path that is inside PROJECT_DIR', () => {
      const absPath = join(projectDir, 'src', 'index.ts');
      const result = validatePath(absPath, projectDir);
      expect(result).toBe(absPath);
    });

    it('accepts the PROJECT_DIR root itself', () => {
      const result = validatePath(projectDir, projectDir);
      expect(result).toBe(projectDir);
    });
  });

  // ─── Edge cases ───

  describe('edge cases', () => {
    it('rejects an empty string path', () => {
      expect(() => validatePath('', projectDir)).toThrow();
    });

    it('rejects a path that is only whitespace', () => {
      expect(() => validatePath('   ', projectDir)).toThrow();
    });

    it('handles paths with trailing slashes', () => {
      const result = validatePath('src/', projectDir);
      // Should resolve without error; exact trailing slash behavior may vary
      expect(result).toContain(join(projectDir, 'src'));
    });

    it('handles paths with double slashes', () => {
      const result = validatePath('src//index.ts', projectDir);
      expect(result).toBe(join(projectDir, 'src', 'index.ts'));
    });

    it('rejects null byte injection', () => {
      expect(() => validatePath('src/index.ts\0.jpg', projectDir)).toThrow();
    });
  });
});
