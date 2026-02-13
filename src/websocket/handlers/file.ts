// WebSocket handlers for file:open and file:save messages from Electron clients.
// Reads/writes files via the file-system layer and responds with fs:content or fs:save_ack/fs:save_error.

import { WebSocket as WsWebSocket } from 'ws';

import { loadEnv } from '../../config/env.js';
import { getDatabase } from '../../database/db.js';
import { readFile, writeFile } from '../../file-system/file-ops.js';
import { logAction } from '../../logger/action-log.js';
import { getActiveSessionId } from '../../mcp/session.js';
import type { ActionType } from '../../types/domain.js';
import type { FileOpenData, FileSaveData } from '../../types/websocket.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sends a typed JSON message to the client.
 * No-ops if the socket is not in the OPEN state.
 * Sends in the format expected by Electron UI: { type, payload, timestamp }
 */
function send(ws: WsWebSocket, type: string, payload: unknown): void {
  if (ws.readyState === WsWebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
  }
}

/**
 * Sends a connection:error message to the client.
 */
function sendError(
  ws: WsWebSocket,
  code: 'INTERNAL_ERROR' | 'NOT_IMPLEMENTED' | 'INVALID_MESSAGE',
  message: string,
  context?: Record<string, unknown>,
): void {
  send(ws, 'connection:error', { code, message, context });
}

/**
 * Logs an action to the database, swallowing any errors to avoid
 * disrupting the main handler flow.
 */
function safeLogAction(actionType: ActionType, data?: Record<string, unknown>): void {
  const db = getDatabase();
  const sessionId = getActiveSessionId();
  if (db !== null && sessionId !== null) {
    logAction(db, sessionId, actionType, data).catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error(`[ws-handler:file] Failed to log action "${actionType}":`, err);
    });
  }
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/**
 * Handles `file:open` messages from Electron clients.
 * Reads the file from PROJECT_DIR and responds with `fs:content`.
 * On failure, sends `connection:error` with INTERNAL_ERROR code.
 */
export async function handleFileOpen(
  ws: WsWebSocket,
  data: unknown,
  _connectionId: string,
): Promise<void> {
  const { path } = data as FileOpenData;

  try {
    const env = loadEnv();
    const { content, language } = await readFile(path, env.projectDir);
    const lineCount = content.split('\n').length;

    safeLogAction('file_open', { path });

    // Frontend expects 'buffer:content' (not 'fs:content')
    send(ws, 'buffer:content', { path, content, language, lineCount });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error reading file';
    sendError(ws, 'INTERNAL_ERROR', message, { path });
  }
}

/**
 * Handles `file:save` messages from Electron clients.
 * Writes the file to PROJECT_DIR and responds with `fs:save_ack` on success
 * or `fs:save_error` on failure.
 */
export async function handleFileSave(
  ws: WsWebSocket,
  data: unknown,
  _connectionId: string,
): Promise<void> {
  const { path, content } = data as FileSaveData;

  try {
    const env = loadEnv();
    await writeFile(path, content, env.projectDir);

    safeLogAction('file_save', { path });

    // Frontend expects 'save:ack' (not 'fs:save_ack')
    send(ws, 'save:ack', { path, success: true, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error saving file';
    // Frontend expects 'save:ack' with success: false (not 'fs:save_error')
    send(ws, 'save:ack', { path, success: false, error: errorMessage });
  }
}
