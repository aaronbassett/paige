// WebSocket message router: dispatches client->server messages to handlers
// Implementation for T171

import { randomUUID } from 'node:crypto';
import { WebSocket as WsWebSocket } from 'ws';
import { loadEnv } from '../config/env.js';
import { getDatabase } from '../database/db.js';
import { readFile } from '../file-system/file-ops.js';
import { updateBuffer } from '../file-system/buffer-cache.js';
import { logAction } from '../logger/action-log.js';
import type { ActionType } from '../types/domain.js';
import type {
  ClientToServerMessage,
  ConnectionErrorData,
  FileOpenData,
  BufferUpdateData,
  EditorTabSwitchData,
  EditorSelectionData,
  HintsLevelChangeData,
  UserIdleStartData,
  UserIdleEndData,
} from '../types/websocket.js';

// ── Types ────────────────────────────────────────────────────────────────────

/** Handler function signature for client-to-server message types. */
type MessageHandler = (
  ws: WsWebSocket,
  data: unknown,
  connectionId: string,
) => void | Promise<void>;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sends a connection:error message to the client.
 */
function sendError(
  ws: WsWebSocket,
  code: ConnectionErrorData['code'],
  message: string,
  context?: Record<string, unknown>,
): void {
  const errorMsg = { type: 'connection:error', data: { code, message, context } };
  if (ws.readyState === WsWebSocket.OPEN) {
    ws.send(JSON.stringify(errorMsg));
  }
}

/**
 * Sends a typed JSON message to the client.
 */
function send(ws: WsWebSocket, type: string, data: unknown): void {
  if (ws.readyState === WsWebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data }));
  }
}

/**
 * Creates a stub handler that responds with NOT_IMPLEMENTED.
 */
function notImplementedHandler(messageType: string): MessageHandler {
  return (ws: WsWebSocket) => {
    sendError(ws, 'NOT_IMPLEMENTED', `Handler for "${messageType}" is not yet implemented`);
  };
}

/**
 * Safely logs an action, catching and suppressing any database errors.
 * Used for fire-and-forget action logging that must not crash the server.
 */
function safeLogAction(actionType: ActionType, data?: Record<string, unknown>): void {
  const db = getDatabase();
  if (db) {
    logAction(db, 0, actionType, data).catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error(`[ws-router] Failed to log action "${actionType}":`, err);
    });
  }
}

// ── Implemented Handlers ─────────────────────────────────────────────────────

/**
 * Handles connection:hello — responds with connection:init.
 */
function handleConnectionHello(ws: WsWebSocket, _data: unknown, _connectionId: string): void {
  send(ws, 'connection:init', {
    sessionId: randomUUID(),
    capabilities: {
      chromadb_available: false,
      gh_cli_available: false,
    },
    featureFlags: {
      observer_enabled: false,
      practice_mode_enabled: false,
    },
  });
}

/**
 * Handles file:open — reads the file and responds with fs:content.
 */
async function handleFileOpen(
  ws: WsWebSocket,
  data: unknown,
  _connectionId: string,
): Promise<void> {
  const { path: filePath } = data as FileOpenData;

  try {
    const env = loadEnv();
    const { content, language } = await readFile(filePath, env.projectDir);
    const lineCount = content.split('\n').length;

    send(ws, 'fs:content', {
      path: filePath,
      content,
      language,
      lineCount,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error reading file';
    sendError(ws, 'INTERNAL_ERROR', errorMessage, { path: filePath });
  }
}

/**
 * Handles buffer:update — updates the in-memory buffer cache.
 */
function handleBufferUpdate(_ws: WsWebSocket, data: unknown, _connectionId: string): void {
  const { path, content, cursorPosition } = data as BufferUpdateData;
  // The buffer cache expects { line, column } but we receive a single number offset.
  // Convert the offset to a simple cursor position (line 0, column = offset).
  updateBuffer(path, content, { line: 0, column: cursorPosition });
}

/**
 * Handles editor:tab_switch — logs the action.
 */
function handleEditorTabSwitch(_ws: WsWebSocket, data: unknown, _connectionId: string): void {
  const tabData = data as EditorTabSwitchData;
  safeLogAction('editor_tab_switch', {
    fromPath: tabData.fromPath,
    toPath: tabData.toPath,
  });
}

/**
 * Handles editor:selection — logs the action.
 */
function handleEditorSelection(_ws: WsWebSocket, data: unknown, _connectionId: string): void {
  const selData = data as EditorSelectionData;
  safeLogAction('editor_selection', {
    path: selData.path,
    range: selData.range,
    selectedText: selData.selectedText,
  });
}

/**
 * Handles hints:level_change — logs the action.
 */
function handleHintsLevelChange(_ws: WsWebSocket, data: unknown, _connectionId: string): void {
  const hintsData = data as HintsLevelChangeData;
  safeLogAction('hints_level_change', {
    from: hintsData.from,
    to: hintsData.to,
  });
}

/**
 * Handles user:idle_start — logs the action.
 */
function handleUserIdleStart(_ws: WsWebSocket, data: unknown, _connectionId: string): void {
  const idleData = data as UserIdleStartData;
  safeLogAction('user_idle_start', { durationMs: idleData.durationMs });
}

/**
 * Handles user:idle_end — logs the action.
 */
function handleUserIdleEnd(_ws: WsWebSocket, data: unknown, _connectionId: string): void {
  const idleData = data as UserIdleEndData;
  safeLogAction('user_idle_end', { idleDurationMs: idleData.idleDurationMs });
}

// ── Handler Registry ─────────────────────────────────────────────────────────

/** Map of message type -> handler function. */
const handlers = new Map<string, MessageHandler>([
  // Implemented handlers
  ['connection:hello', handleConnectionHello],
  ['file:open', handleFileOpen],
  ['buffer:update', handleBufferUpdate],
  ['editor:tab_switch', handleEditorTabSwitch],
  ['editor:selection', handleEditorSelection],
  ['hints:level_change', handleHintsLevelChange],
  ['user:idle_start', handleUserIdleStart],
  ['user:idle_end', handleUserIdleEnd],

  // Stub handlers (NOT_IMPLEMENTED until T173-T179)
  ['file:save', notImplementedHandler('file:save')],
  ['file:close', notImplementedHandler('file:close')],
  ['file:create', notImplementedHandler('file:create')],
  ['file:delete', notImplementedHandler('file:delete')],
  ['user:explain', notImplementedHandler('user:explain')],
  ['observer:mute', notImplementedHandler('observer:mute')],
  ['practice:submit_solution', notImplementedHandler('practice:submit_solution')],
  ['practice:request_hint', notImplementedHandler('practice:request_hint')],
  ['practice:view_previous_attempts', notImplementedHandler('practice:view_previous_attempts')],
  ['dashboard:request', notImplementedHandler('dashboard:request')],
  ['dashboard:refresh_issues', notImplementedHandler('dashboard:refresh_issues')],
  ['terminal:command', notImplementedHandler('terminal:command')],
  ['tree:expand', notImplementedHandler('tree:expand')],
  ['tree:collapse', notImplementedHandler('tree:collapse')],
  ['review:request', notImplementedHandler('review:request')],
]);

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Routes an incoming client-to-server message to the appropriate handler.
 * Unknown message types receive a NOT_IMPLEMENTED error.
 * Errors thrown by handlers are caught and sent as INTERNAL_ERROR.
 */
export function routeMessage(
  ws: WsWebSocket,
  message: ClientToServerMessage,
  connectionId: string,
): void {
  const handler = handlers.get(message.type);

  if (!handler) {
    // eslint-disable-next-line no-console
    console.warn(`[ws-router] Unknown message type: ${message.type}`);
    sendError(ws, 'NOT_IMPLEMENTED', `Unknown message type: "${message.type}"`);
    return;
  }

  try {
    const result = handler(ws, message.data, connectionId);

    // If the handler returns a Promise, catch any async errors
    if (result instanceof Promise) {
      result.catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : 'Handler error';
        // eslint-disable-next-line no-console
        console.error(`[ws-router] Handler error for ${message.type}:`, errorMessage);
        sendError(ws, 'INTERNAL_ERROR', errorMessage, { messageType: message.type });
      });
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Handler error';
    // eslint-disable-next-line no-console
    console.error(`[ws-router] Handler error for ${message.type}:`, errorMessage);
    sendError(ws, 'INTERNAL_ERROR', errorMessage, { messageType: message.type });
  }
}
