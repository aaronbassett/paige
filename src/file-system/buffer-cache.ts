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

/** Module-level buffer cache. */
const buffers = new Map<string, BufferEntry>();

/**
 * Gets the buffer entry for a given file path.
 * @param path - Absolute file path
 * @returns The BufferEntry or null if not in cache
 */
export function getBuffer(path: string): BufferEntry | null {
  return buffers.get(path) ?? null;
}

/**
 * Updates the buffer cache for a file (from buffer:update messages).
 * Sets dirty: true and lastUpdated to now.
 * @param path - Absolute file path
 * @param content - Current buffer content
 * @param cursorPosition - Current cursor position
 */
export function updateBuffer(path: string, content: string, cursorPosition: CursorPosition): void {
  buffers.set(path, {
    content,
    cursorPosition,
    dirty: true,
    lastUpdated: new Date().toISOString(),
  });
}

/**
 * Marks a buffer as clean (dirty: false) after a file save.
 * No-op if the path is not in the cache.
 * @param path - Absolute file path
 */
export function markClean(path: string): void {
  const entry = buffers.get(path);
  if (entry) {
    entry.dirty = false;
  }
}

/**
 * Removes a buffer entry from the cache.
 * No-op if the path is not in the cache.
 * @param path - Absolute file path
 */
export function removeBuffer(path: string): void {
  buffers.delete(path);
}

/**
 * Clears all buffer entries (e.g., on session end).
 */
export function clearAll(): void {
  buffers.clear();
}

/**
 * Gets all dirty buffer paths.
 * @returns Array of file paths with dirty buffers
 */
export function getDirtyPaths(): string[] {
  const dirty: string[] = [];
  for (const [path, entry] of buffers) {
    if (entry.dirty) {
      dirty.push(path);
    }
  }
  return dirty;
}
