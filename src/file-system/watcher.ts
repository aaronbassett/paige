// File system watcher using Chokidar
// Implements FR-035 through FR-037

import { EventEmitter } from 'node:events';
import { relative } from 'node:path';

import { watch, type FSWatcher } from 'chokidar';

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
 * Glob patterns excluded from file watching.
 * Mirrors the NOISE_DIRS set in tree.ts to keep filtering consistent.
 */
const IGNORED_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.next/**',
  '**/.cache/**',
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
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
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
