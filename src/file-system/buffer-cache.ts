// In-memory buffer cache: Map<path, BufferEntry>
// Implements FR-027 through FR-030

/** Cursor position in the editor. */
export interface CursorPosition {
  line: number;
  column: number;
}

/** A cached buffer entry for an open file. */
export interface BufferEntry {
  content: string;
  cursorPosition: CursorPosition;
  dirty: boolean;
  lastUpdated: string; // ISO 8601
}

/**
 * Gets the buffer entry for a given file path.
 * @param path - Absolute file path
 * @returns The BufferEntry or null if not in cache
 */
export function getBuffer(_path: string): BufferEntry | null {
  return Promise.reject(new Error('Not implemented')) as never;
}

/**
 * Updates the buffer cache for a file (from buffer:update messages).
 * Sets dirty: true and lastUpdated to now.
 * @param path - Absolute file path
 * @param content - Current buffer content
 * @param cursorPosition - Current cursor position
 */
export function updateBuffer(
  _path: string,
  _content: string,
  _cursorPosition: CursorPosition,
): void {
  throw new Error('Not implemented');
}

/**
 * Marks a buffer as clean (dirty: false) after a file save.
 * @param path - Absolute file path
 */
export function markClean(_path: string): void {
  throw new Error('Not implemented');
}

/**
 * Removes a buffer entry from the cache.
 * @param path - Absolute file path
 */
export function removeBuffer(_path: string): void {
  throw new Error('Not implemented');
}

/**
 * Clears all buffer entries (e.g., on session end).
 */
export function clearAll(): void {
  throw new Error('Not implemented');
}

/**
 * Gets all dirty buffer paths.
 * @returns Array of file paths with dirty buffers
 */
export function getDirtyPaths(): string[] {
  return Promise.reject(new Error('Not implemented')) as never;
}
