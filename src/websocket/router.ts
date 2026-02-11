// WebSocket message router: dispatches client->server messages to handlers
// Implementation for T171

import { WebSocket as WsWebSocket } from 'ws';
import { getDatabase } from '../database/db.js';
import { logAction } from '../logger/action-log.js';
import type { ActionType } from '../types/domain.js';
import type {
  ClientToServerMessage,
  ConnectionErrorData,
  EditorTabSwitchData,
  EditorSelectionData,
  HintsLevelChangeData,
  UserIdleStartData,
  UserIdleEndData,
} from '../types/websocket.js';
import { handleConnectionHello } from './handlers/connection.js';
import { handleFileOpen, handleFileSave } from './handlers/file.js';
import { handleBufferUpdate } from './handlers/buffer.js';

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

// ── Inline Handlers (to be extracted in T177-T179) ──────────────────────────

function handleEditorTabSwitch(_ws: WsWebSocket, data: unknown, _connectionId: string): void {
  const tabData = data as EditorTabSwitchData;
  safeLogAction('editor_tab_switch', {
    fromPath: tabData.fromPath,
    toPath: tabData.toPath,
  });
}

function handleEditorSelection(_ws: WsWebSocket, data: unknown, _connectionId: string): void {
  const selData = data as EditorSelectionData;
  safeLogAction('editor_selection', {
    path: selData.path,
    range: selData.range,
    selectedText: selData.selectedText,
  });
}

function handleHintsLevelChange(_ws: WsWebSocket, data: unknown, _connectionId: string): void {
  const hintsData = data as HintsLevelChangeData;
  safeLogAction('hints_level_change', {
    from: hintsData.from,
    to: hintsData.to,
  });
}

function handleUserIdleStart(_ws: WsWebSocket, data: unknown, _connectionId: string): void {
  const idleData = data as UserIdleStartData;
  safeLogAction('user_idle_start', { durationMs: idleData.durationMs });
}

function handleUserIdleEnd(_ws: WsWebSocket, data: unknown, _connectionId: string): void {
  const idleData = data as UserIdleEndData;
  safeLogAction('user_idle_end', { idleDurationMs: idleData.idleDurationMs });
}

// ── Handler Registry ─────────────────────────────────────────────────────────

/** Map of message type -> handler function. */
const handlers = new Map<string, MessageHandler>([
  // Core handlers (T173-T175)
  ['connection:hello', handleConnectionHello],
  ['file:open', handleFileOpen],
  ['file:save', handleFileSave],
  ['buffer:update', handleBufferUpdate],

  // Inline handlers (to be extracted in T177-T179)
  ['editor:tab_switch', handleEditorTabSwitch],
  ['editor:selection', handleEditorSelection],
  ['hints:level_change', handleHintsLevelChange],
  ['user:idle_start', handleUserIdleStart],
  ['user:idle_end', handleUserIdleEnd],

  // Stub handlers (NOT_IMPLEMENTED — later phases)
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
