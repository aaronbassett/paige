// File system watcher using Chokidar
// Implements FR-035 through FR-037

import { EventEmitter } from 'node:events';
import { relative } from 'node:path';

import { watch, type FSWatcher } from 'chokidar';

import { getLogger } from '../logger/logtape.js';

const logger = getLogger(['paige', 'watcher']);

/** Types of file system change events. */
export type FileChangeType = 'add' | 'change' | 'unlink';

/** A file system change event. */
export interface FileChangeEvent {
  type: FileChangeType;
  path: string; // relative to PROJECT_DIR
}

/** File watcher handle for lifecycle management. */
export interface FileWatcher extends EventEmitter {
  /** Start watching PROJECT_DIR. */
  start: () => Promise<void>;
  /** Stop watching and clean up. */
  close: () => Promise<void>;
}

/**
 * Glob patterns and matcher function for excluding files from watching.
 * Mirrors the NOISE_DIRS set in tree.ts to keep filtering consistent.
 * Aggressive patterns to avoid EMFILE (too many open files) on macOS.
 */
const IGNORED_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.next/**',
  '**/.cache/**',
  '**/.turbo/**',
  '**/.pnp/**',
  '**/.yarn/**',
  '**/tmp/**',
  '**/temp/**',
  '**/.DS_Store',
  '**/*.log',
  '**/.worktrees/**',
  // Electron UI has its own dev server, no need to watch
  '**/electron-ui/**',
  // Function matcher for Unix sockets, PID files, and Overmind files
  (path: string) => {
    return (
      path.endsWith('.sock') ||
      path.endsWith('.pid') ||
      path.endsWith('.db') ||
      path.endsWith('.db-wal') ||
      path.endsWith('.db-shm') ||
      path.includes('.overmind.sock') ||
      path.includes('.overmind.')
    );
  },
];

/**
 * Creates a file watcher for PROJECT_DIR using Chokidar.
 * Emits 'change' events of type FileChangeEvent with paths relative to projectDir.
 *
 * Usage:
 * ```ts
 * const watcher = createFileWatcher('/path/to/project');
 * watcher.on('change', (event: FileChangeEvent) => {
 *   console.log(event.type, event.path);
 * });
 * await watcher.start();
 * // ... later
 * await watcher.close();
 * ```
 *
 * @param projectDir - Root directory to watch
 * @returns A FileWatcher that can be started and stopped
 */
export function createFileWatcher(projectDir: string): FileWatcher {
  const emitter = new EventEmitter() as FileWatcher;
  let watcher: FSWatcher | null = null;

  emitter.start = () => {
    watcher = watch(projectDir, {
      ignored: IGNORED_PATTERNS,
      persistent: true,
      ignoreInitial: true,
      ignorePermissionErrors: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
      // Use polling on macOS to avoid EMFILE errors
      usePolling: process.platform === 'darwin',
      interval: 1000, // Poll every 1 second
      binaryInterval: 3000, // Poll binary files every 3 seconds
    });

    const handleEvent = (type: FileChangeType, absolutePath: string): void => {
      const relPath = relative(projectDir, absolutePath);
      emitter.emit('change', { type, path: relPath } satisfies FileChangeEvent);
    };

    watcher.on('add', (path: string) => {
      handleEvent('add', path);
    });
    watcher.on('change', (path: string) => {
      handleEvent('change', path);
    });
    watcher.on('unlink', (path: string) => {
      handleEvent('unlink', path);
    });

    // Swallow errors for inaccessible files, Unix sockets, and file limit issues
    watcher.on('error', (error: unknown) => {
      const nodeErr = error as NodeJS.ErrnoException;
      // Ignore permission errors
      if (nodeErr.code === 'EACCES') return;
      // Ignore socket/special file errors
      if (nodeErr.code === 'UNKNOWN' && nodeErr.path?.endsWith('.sock')) return;
      if (nodeErr.code === 'UNKNOWN' && nodeErr.path?.includes('.overmind')) return;
      // Ignore EMFILE errors (too many open files) - polling fallback will handle it
      if (nodeErr.code === 'EMFILE') {
        logger.warn`Too many open files - using polling mode`;
        return;
      }
      emitter.emit('error', error);
    });

    // Wait for the watcher to be ready before resolving
    return new Promise<void>((resolve) => {
      watcher!.on('ready', resolve);
    });
  };

  emitter.close = () => {
    if (watcher) {
      const closing = watcher.close();
      watcher = null;
      return closing;
    }
    return Promise.resolve();
  };

  return emitter;
}
