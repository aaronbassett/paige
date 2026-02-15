// Git operations module — wraps child_process.execFile for type-safe git commands.
// All functions accept `cwd` to specify the working directory for git operations.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// ── Internal Helper ─────────────────────────────────────────────────────────

/**
 * Run a git command in the given directory and return stdout.
 * Uses trimEnd() to strip trailing newlines while preserving leading
 * whitespace (important for porcelain status output).
 */
async function gitExec(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd });
  return stdout.trimEnd();
}

// ── Status ──────────────────────────────────────────────────────────────────

/** Parsed working tree status. */
interface GitStatus {
  readonly clean: boolean;
  readonly modifiedFiles: string[];
  readonly untrackedFiles: string[];
}

/** Get working tree status using porcelain format for reliable parsing. */
export async function gitStatus(cwd: string): Promise<GitStatus> {
  const output = await gitExec(['status', '--porcelain'], cwd);
  if (output === '') return { clean: true, modifiedFiles: [], untrackedFiles: [] };

  const modifiedFiles: string[] = [];
  const untrackedFiles: string[] = [];

  for (const line of output.split('\n')) {
    if (line.startsWith('??')) {
      untrackedFiles.push(line.slice(3));
    } else if (line.length > 0) {
      modifiedFiles.push(line.slice(3));
    }
  }

  return { clean: false, modifiedFiles, untrackedFiles };
}

// ── Branch Operations ───────────────────────────────────────────────────────

/** Checkout an existing branch. */
export async function gitCheckout(branch: string, cwd: string): Promise<void> {
  await gitExec(['checkout', branch], cwd);
}

/** Create and switch to a new branch. */
export async function gitBranchCreate(branch: string, cwd: string): Promise<void> {
  await gitExec(['checkout', '-b', branch], cwd);
}

// ── Remote Operations ───────────────────────────────────────────────────────

/** Pull latest changes from origin main. */
export async function gitPull(cwd: string): Promise<void> {
  await gitExec(['pull', 'origin', 'main'], cwd);
}

/** Pull with rebase from origin main. */
export async function gitPullRebase(cwd: string): Promise<void> {
  await gitExec(['pull', '--rebase', 'origin', 'main'], cwd);
}

/** Push branch to origin with upstream tracking. */
export async function gitPush(branch: string, cwd: string): Promise<void> {
  await gitExec(['push', '-u', 'origin', branch], cwd);
}

// ── Staging & Committing ────────────────────────────────────────────────────

/** Stage all changes (tracked + untracked). */
export async function gitAddAll(cwd: string): Promise<void> {
  await gitExec(['add', '-A'], cwd);
}

/** Create a conventional commit. Body is optional. */
export async function gitCommit(
  type: string,
  subject: string,
  body: string,
  cwd: string,
): Promise<void> {
  const message = body ? `${type}: ${subject}\n\n${body}` : `${type}: ${subject}`;
  await gitExec(['commit', '-m', message], cwd);
}

// ── Stash Operations ────────────────────────────────────────────────────────

/** Create a named stash. */
export async function gitStashPush(name: string, cwd: string): Promise<void> {
  await gitExec(['stash', 'push', '-m', name], cwd);
}

/** Apply a stash by name. Throws if the named stash is not found. */
export async function gitStashApply(name: string, cwd: string): Promise<void> {
  const list = await gitExec(['stash', 'list'], cwd);
  const match = list.split('\n').find((line) => line.includes(name));
  if (!match) throw new Error(`Stash "${name}" not found`);
  const stashRef = match.split(':')[0];
  if (!stashRef) throw new Error(`Could not parse stash reference from: ${match}`);
  await gitExec(['stash', 'apply', stashRef], cwd);
}

/** Drop a stash by name. Throws if the named stash is not found. */
export async function gitStashDrop(name: string, cwd: string): Promise<void> {
  const list = await gitExec(['stash', 'list'], cwd);
  const match = list.split('\n').find((line) => line.includes(name));
  if (!match) throw new Error(`Stash "${name}" not found`);
  const stashRef = match.split(':')[0];
  if (!stashRef) throw new Error(`Could not parse stash reference from: ${match}`);
  await gitExec(['stash', 'drop', stashRef], cwd);
}

// ── Diff & Log ──────────────────────────────────────────────────────────────

/** Show diff of all changes against HEAD. */
export async function gitDiff(cwd: string): Promise<string> {
  return gitExec(['diff', 'HEAD'], cwd);
}

/** Show one-line log for a given range (e.g. "main..HEAD"). */
export async function gitLog(range: string, cwd: string): Promise<string> {
  return gitExec(['log', range, '--oneline'], cwd);
}

// ── Destructive Operations ──────────────────────────────────────────────────

/** Revert all working tree changes: checkout tracked files and clean untracked. */
export async function gitRevertAll(cwd: string): Promise<void> {
  await gitExec(['checkout', '--', '.'], cwd);
  await gitExec(['clean', '-fd'], cwd);
}
