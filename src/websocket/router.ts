// WebSocket message router: dispatches client->server messages to handlers
// Implementation for T171

import { WebSocket as WsWebSocket } from 'ws';
import type { ClientToServerMessage, ConnectionErrorData } from '../types/websocket.js';
import { handleConnectionHello } from './handlers/connection.js';
import { handleFileOpen, handleFileSave } from './handlers/file.js';
import { handleBufferUpdate } from './handlers/buffer.js';
import { handleEditorTabSwitch, handleEditorSelection } from './handlers/editor.js';
import { handleHintsLevelChange } from './handlers/hints.js';
import { handleUserIdleStart, handleUserIdleEnd, handleUserExplain } from './handlers/user.js';
import { handleObserverMute } from './handlers/observer.js';
import { handlePracticeSubmitSolution } from './handlers/practice.js';
import { handleDashboardRequestWs, handleDashboardRefreshIssuesWs } from './handlers/dashboard.js';
import { handleReposList, handleReposActivity } from './handlers/repos.js';
import { handleSessionStartRepo, handleSessionSelectIssue } from './handlers/session-start.js';

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
  const errorMsg = {
    type: 'connection:error',
    payload: { code, message, context },
    timestamp: Date.now()
  };
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

// ── Handler Registry ─────────────────────────────────────────────────────────

/** Map of message type -> handler function. */
const handlers = new Map<string, MessageHandler>([
  // Core handlers (T173-T175)
  ['connection:hello', handleConnectionHello],
  ['file:open', handleFileOpen],
  ['file:save', handleFileSave],
  ['buffer:update', handleBufferUpdate],

  // Additional handlers (T177-T179)
  ['editor:tab_switch', handleEditorTabSwitch],
  ['editor:selection', handleEditorSelection],
  ['hints:level_change', handleHintsLevelChange],
  ['user:idle_start', handleUserIdleStart],
  ['user:idle_end', handleUserIdleEnd],

  // Stub handlers (NOT_IMPLEMENTED — later phases)
  ['file:close', notImplementedHandler('file:close')],
  ['file:create', notImplementedHandler('file:create')],
  ['file:delete', notImplementedHandler('file:delete')],
  ['user:explain', handleUserExplain],
  ['observer:mute', handleObserverMute],
  ['practice:submit_solution', handlePracticeSubmitSolution],
  ['practice:request_hint', notImplementedHandler('practice:request_hint')],
  ['practice:view_previous_attempts', notImplementedHandler('practice:view_previous_attempts')],
  ['dashboard:request', handleDashboardRequestWs],
  ['dashboard:refresh_issues', handleDashboardRefreshIssuesWs],
  ['repos:list', handleReposList],
  ['repos:activity', handleReposActivity],
  ['session:start_repo', handleSessionStartRepo],
  ['session:select_issue', handleSessionSelectIssue],
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
