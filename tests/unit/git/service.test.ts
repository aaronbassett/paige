import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Setup ──────────────────────────────────────────────────────────────
// The service module calls `promisify(execFile)` at import time, producing
// `execFileAsync`. We mock `node:util` so that `promisify` returns a vi.fn()
// we control. vi.hoisted() ensures the mock is available when vi.mock
// factories run (vi.mock calls are hoisted above all other code).

const { mockExecFileAsync } = vi.hoisted(() => ({
  mockExecFileAsync:
    vi.fn<
      (
        cmd: string,
        args: string[],
        opts: { cwd: string },
      ) => Promise<{ stdout: string; stderr: string }>
    >(),
}));

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:util', () => ({
  promisify: () => mockExecFileAsync,
}));

// Import after mocks are registered so the module picks up the mock.
import {
  gitStatus,
  gitCheckout,
  gitBranchCreate,
  gitCommit,
  gitPush,
  gitAddAll,
  gitStashPush,
  gitStashApply,
  gitStashDrop,
  gitDiff,
  gitLog,
  gitRevertAll,
  gitPull,
  gitPullRebase,
} from '../../../src/git/service.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Configure mockExecFileAsync to return the given stdout for every call. */
function mockStdout(stdout: string): void {
  mockExecFileAsync.mockResolvedValue({ stdout, stderr: '' });
}

/**
 * Configure mockExecFileAsync to return different stdout values on
 * successive calls. Useful for functions that invoke git multiple times
 * (e.g. gitRevertAll calls checkout then clean).
 */
function mockStdoutSequence(...values: string[]): void {
  for (const value of values) {
    mockExecFileAsync.mockResolvedValueOnce({ stdout: value, stderr: '' });
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('git/service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── gitStatus ───────────────────────────────────────────────────────────

  describe('gitStatus', () => {
    it('returns clean status when working tree has no changes', async () => {
      mockStdout('');

      const result = await gitStatus('/repo');

      expect(result).toEqual({ clean: true, modifiedFiles: [], untrackedFiles: [] });
      expect(mockExecFileAsync).toHaveBeenCalledWith('git', ['status', '--porcelain'], {
        cwd: '/repo',
      });
    });

    it('parses modified and untracked files from porcelain output', async () => {
      mockStdout(' M src/index.ts\n M src/utils.ts\n?? new-file.ts\n?? docs/readme.md');

      const result = await gitStatus('/repo');

      expect(result.clean).toBe(false);
      expect(result.modifiedFiles).toEqual(['src/index.ts', 'src/utils.ts']);
      expect(result.untrackedFiles).toEqual(['new-file.ts', 'docs/readme.md']);
    });

    it('handles staged files in porcelain output', async () => {
      mockStdout('A  staged-new.ts\nM  staged-modified.ts');

      const result = await gitStatus('/repo');

      expect(result.clean).toBe(false);
      expect(result.modifiedFiles).toEqual(['staged-new.ts', 'staged-modified.ts']);
      expect(result.untrackedFiles).toEqual([]);
    });
  });

  // ── gitCheckout ─────────────────────────────────────────────────────────

  describe('gitCheckout', () => {
    it('runs git checkout with the specified branch', async () => {
      mockStdout('');

      await gitCheckout('feature/login', '/repo');

      expect(mockExecFileAsync).toHaveBeenCalledWith('git', ['checkout', 'feature/login'], {
        cwd: '/repo',
      });
    });
  });

  // ── gitBranchCreate ─────────────────────────────────────────────────────

  describe('gitBranchCreate', () => {
    it('runs git checkout -b with the specified branch name', async () => {
      mockStdout('');

      await gitBranchCreate('feature/new-branch', '/repo');

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        'git',
        ['checkout', '-b', 'feature/new-branch'],
        { cwd: '/repo' },
      );
    });
  });

  // ── gitPull ─────────────────────────────────────────────────────────────

  describe('gitPull', () => {
    it('pulls from origin main', async () => {
      mockStdout('');

      await gitPull('/repo');

      expect(mockExecFileAsync).toHaveBeenCalledWith('git', ['pull', 'origin', 'main'], {
        cwd: '/repo',
      });
    });
  });

  // ── gitPullRebase ───────────────────────────────────────────────────────

  describe('gitPullRebase', () => {
    it('pulls with rebase from origin main', async () => {
      mockStdout('');

      await gitPullRebase('/repo');

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        'git',
        ['pull', '--rebase', 'origin', 'main'],
        { cwd: '/repo' },
      );
    });
  });

  // ── gitPush ─────────────────────────────────────────────────────────────

  describe('gitPush', () => {
    it('pushes with upstream tracking flag', async () => {
      mockStdout('');

      await gitPush('feature/login', '/repo');

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        'git',
        ['push', '-u', 'origin', 'feature/login'],
        { cwd: '/repo' },
      );
    });
  });

  // ── gitAddAll ───────────────────────────────────────────────────────────

  describe('gitAddAll', () => {
    it('stages all changes with -A flag', async () => {
      mockStdout('');

      await gitAddAll('/repo');

      expect(mockExecFileAsync).toHaveBeenCalledWith('git', ['add', '-A'], { cwd: '/repo' });
    });
  });

  // ── gitCommit ───────────────────────────────────────────────────────────

  describe('gitCommit', () => {
    it('formats conventional commit message without body', async () => {
      mockStdout('');

      await gitCommit('feat', 'add login page', '', '/repo');

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        'git',
        ['commit', '-m', 'feat: add login page'],
        { cwd: '/repo' },
      );
    });

    it('formats conventional commit message with body', async () => {
      mockStdout('');

      await gitCommit('fix', 'resolve null pointer', 'The user object was not checked', '/repo');

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        'git',
        ['commit', '-m', 'fix: resolve null pointer\n\nThe user object was not checked'],
        { cwd: '/repo' },
      );
    });
  });

  // ── gitStashPush ────────────────────────────────────────────────────────

  describe('gitStashPush', () => {
    it('creates a named stash', async () => {
      mockStdout('');

      await gitStashPush('wip-feature', '/repo');

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        'git',
        ['stash', 'push', '-m', 'wip-feature'],
        { cwd: '/repo' },
      );
    });
  });

  // ── gitStashApply ───────────────────────────────────────────────────────

  describe('gitStashApply', () => {
    it('finds and applies a stash by name', async () => {
      // First call: stash list returns matching entry
      // Second call: stash apply succeeds
      mockStdoutSequence('stash@{0}: On main: wip-feature\nstash@{1}: On main: other-stash', '');

      await gitStashApply('wip-feature', '/repo');

      expect(mockExecFileAsync).toHaveBeenNthCalledWith(1, 'git', ['stash', 'list'], {
        cwd: '/repo',
      });
      expect(mockExecFileAsync).toHaveBeenNthCalledWith(2, 'git', ['stash', 'apply', 'stash@{0}'], {
        cwd: '/repo',
      });
    });

    it('throws when the named stash is not found', async () => {
      mockStdout('stash@{0}: On main: other-stash');

      await expect(gitStashApply('nonexistent', '/repo')).rejects.toThrow(
        'Stash "nonexistent" not found',
      );
    });
  });

  // ── gitStashDrop ────────────────────────────────────────────────────────

  describe('gitStashDrop', () => {
    it('finds and drops a stash by name', async () => {
      mockStdoutSequence('stash@{0}: On main: temp-work\nstash@{1}: On main: wip-feature', '');

      await gitStashDrop('wip-feature', '/repo');

      expect(mockExecFileAsync).toHaveBeenNthCalledWith(1, 'git', ['stash', 'list'], {
        cwd: '/repo',
      });
      expect(mockExecFileAsync).toHaveBeenNthCalledWith(2, 'git', ['stash', 'drop', 'stash@{1}'], {
        cwd: '/repo',
      });
    });

    it('throws when the named stash is not found', async () => {
      mockStdout('stash@{0}: On main: other-stash');

      await expect(gitStashDrop('nonexistent', '/repo')).rejects.toThrow(
        'Stash "nonexistent" not found',
      );
    });
  });

  // ── gitDiff ─────────────────────────────────────────────────────────────

  describe('gitDiff', () => {
    it('returns diff output from HEAD', async () => {
      const diffOutput = 'diff --git a/file.ts b/file.ts\n+added line';
      mockStdout(diffOutput);

      const result = await gitDiff('/repo');

      expect(result).toBe(diffOutput);
      expect(mockExecFileAsync).toHaveBeenCalledWith('git', ['diff', 'HEAD'], { cwd: '/repo' });
    });
  });

  // ── gitLog ──────────────────────────────────────────────────────────────

  describe('gitLog', () => {
    it('returns one-line log for the given range', async () => {
      const logOutput = 'abc1234 feat: add login\ndef5678 fix: resolve bug';
      mockStdout(logOutput);

      const result = await gitLog('main..HEAD', '/repo');

      expect(result).toBe(logOutput);
      expect(mockExecFileAsync).toHaveBeenCalledWith('git', ['log', 'main..HEAD', '--oneline'], {
        cwd: '/repo',
      });
    });
  });

  // ── gitRevertAll ────────────────────────────────────────────────────────

  describe('gitRevertAll', () => {
    it('runs checkout and clean to discard all changes', async () => {
      mockStdoutSequence('', '');

      await gitRevertAll('/repo');

      expect(mockExecFileAsync).toHaveBeenCalledTimes(2);
      expect(mockExecFileAsync).toHaveBeenNthCalledWith(1, 'git', ['checkout', '--', '.'], {
        cwd: '/repo',
      });
      expect(mockExecFileAsync).toHaveBeenNthCalledWith(2, 'git', ['clean', '-fd'], {
        cwd: '/repo',
      });
    });
  });
});
