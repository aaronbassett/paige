// File system watcher using Chokidar
// Implements FR-035 through FR-037

import type { EventEmitter } from 'node:events';

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
 * Creates a file watcher for PROJECT_DIR using Chokidar.
 * Emits 'change' events of type FileChangeEvent.
 * @param projectDir - Root directory to watch
 * @returns A FileWatcher that can be started and stopped
 */
export function createFileWatcher(_projectDir: string): FileWatcher {
  throw new Error('Not implemented');
}
