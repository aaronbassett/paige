// WebSocket handler for buffer:update messages from Electron clients.
// Updates the in-memory buffer cache and checks for significant changes.
// No response is sent back per protocol spec.

import type { WebSocket as WsWebSocket } from 'ws';

import { updateBuffer } from '../../file-system/buffer-cache.js';
import { getDatabase } from '../../database/db.js';
import { checkSignificantChange } from '../../logger/action-log.js';
import type { BufferUpdateData } from '../../types/websocket.js';

// ── Handler ──────────────────────────────────────────────────────────────────

/**
 * Handles `buffer:update` messages from Electron clients.
 * Updates the in-memory buffer cache with the latest content and cursor position.
 * Optionally checks for significant changes and logs them (fire-and-forget).
 *
 * No response is sent — buffer:update is a one-way client notification.
 */
export function handleBufferUpdate(_ws: WsWebSocket, data: unknown, _connectionId: string): void {
  const { path, content, cursorPosition } = data as BufferUpdateData;

  // Convert character offset to CursorPosition { line, column }
  updateBuffer(path, content, { line: 0, column: cursorPosition });

  // Fire-and-forget: check for significant change if DB is available
  const db = getDatabase();
  if (db !== null) {
    checkSignificantChange(db, 0, path, content.length).catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[buffer] checkSignificantChange failed:', err);
    });
  }
}
