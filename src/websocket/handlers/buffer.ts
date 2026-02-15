// WebSocket handler for buffer:update messages from Electron clients.
// Updates the in-memory buffer cache and checks for significant changes.
// No response is sent back per protocol spec.

import type { WebSocket as WsWebSocket } from 'ws';

import { updateBuffer } from '../../file-system/buffer-cache.js';
import { getDatabase } from '../../database/db.js';
import { checkSignificantChange } from '../../logger/action-log.js';
import { getLogger } from '../../logger/logtape.js';
import { getActiveSessionId } from '../../mcp/session.js';

const logger = getLogger(['paige', 'ws-handler', 'buffer']);
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

  // Fire-and-forget: check for significant change if DB and session are available
  const db = getDatabase();
  const sessionId = getActiveSessionId();
  if (db !== null && sessionId !== null) {
    checkSignificantChange(db, sessionId, path, content.length).catch((err: unknown) => {
      logger.error`checkSignificantChange failed: ${err}`;
    });
  }
}
