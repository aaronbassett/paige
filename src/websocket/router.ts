// WebSocket message router: dispatches client->server messages to handlers
// Implementation for T171

import { WebSocket as WsWebSocket } from 'ws';
import { getLogger } from '../logger/logtape.js';
import type { ClientToServerMessage, ConnectionErrorData } from '../types/websocket.js';

const logger = getLogger(['paige', 'ws-router']);
import { resolveSession, touchSession } from '../session/resolve.js';
import { handleConnectionHello } from './handlers/connection.js';
import { handleFileOpen, handleFileSave } from './handlers/file.js';
import { handleBufferUpdate } from './handlers/buffer.js';
import { handleEditorTabSwitch, handleEditorSelection } from './handlers/editor.js';
import { handleHintsLevelChange } from './handlers/hints.js';
import { handleUserIdleStart, handleUserIdleEnd, handleUserExplain } from './handlers/user.js';
import { handleObserverMute } from './handlers/observer.js';
import { handlePracticeSubmitSolution } from './handlers/practice.js';
import { handleChallengeLoad } from './handlers/challenge.js';
import {
  handleDashboardRequestWs,
  handleDashboardRefreshIssuesWs,
  handleDashboardStatsPeriodWs,
} from './handlers/dashboard.js';
import { handleReposList, handleReposActivity } from './handlers/repos.js';
import { handleSessionStartRepo } from './handlers/session-start.js';
import { handlePlanningStart } from './handlers/planning.js';
import { handleFsRequestTree } from './handlers/file-tree.js';
import {
  handleTerminalReady,
  handleTerminalResize,
  handleTerminalInput,
} from './handlers/terminal.js';
import { handleReviewRequest } from './handlers/review.js';
import { handleCommitSuggest, handleCommitExecute } from './handlers/commit.js';
import { handlePrSuggest, handlePrCreate } from './handlers/pr.js';
import { handleGitStatus, handleGitSaveAndExit, handleGitDiscardAndExit } from './handlers/git.js';
import {
  handleMaterialsView,
  handleMaterialsComplete,
  handleMaterialsDismiss,
  handleMaterialsList,
} from './handlers/materials.js';

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
    timestamp: Date.now(),
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
  ['challenge:load', handleChallengeLoad],
  ['dashboard:request', handleDashboardRequestWs],
  ['dashboard:refresh_issues', handleDashboardRefreshIssuesWs],
  ['dashboard:stats_period', handleDashboardStatsPeriodWs],
  ['repos:list', handleReposList],
  ['repos:activity', handleReposActivity],
  ['session:start_repo', handleSessionStartRepo],
  ['session:select_issue', handlePlanningStart],
  ['terminal:ready', handleTerminalReady],
  ['terminal:resize', handleTerminalResize],
  ['terminal:input', handleTerminalInput],
  ['terminal:command', notImplementedHandler('terminal:command')],
  ['tree:expand', notImplementedHandler('tree:expand')],
  ['tree:collapse', notImplementedHandler('tree:collapse')],
  ['review:request', handleReviewRequest],
  ['commit:suggest', handleCommitSuggest],
  ['commit:execute', handleCommitExecute],
  ['pr:suggest', handlePrSuggest],
  ['pr:create', handlePrCreate],
  ['git:status', handleGitStatus],
  ['git:save_and_exit', handleGitSaveAndExit],
  ['git:discard_and_exit', handleGitDiscardAndExit],
  ['fs:request_tree', handleFsRequestTree],

  // Learning materials handlers (Task 8)
  ['materials:view', handleMaterialsView],
  ['materials:complete', handleMaterialsComplete],
  ['materials:dismiss', handleMaterialsDismiss],
  ['materials:list', handleMaterialsList],
]);

// ── Session Resolution Categories ────────────────────────────────────────────

/** Messages exempt from session resolution (initial handshake). */
const SESSION_EXEMPT: ReadonlySet<string> = new Set([
  'connection:hello',
  'fs:request_tree',
  'terminal:ready',
]);

/** High-frequency messages that only need a lightweight touch. */
const SESSION_TOUCH: ReadonlySet<string> = new Set([
  'buffer:update',
  'editor:tab_switch',
  'editor:selection',
  'terminal:input',
  'terminal:resize',
]);

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Routes an incoming client-to-server message to the appropriate handler.
 * Before dispatching, resolves or touches the active session based on message type.
 * Unknown message types receive a NOT_IMPLEMENTED error.
 * Errors thrown by handlers are caught and sent as INTERNAL_ERROR.
 */
export async function routeMessage(
  ws: WsWebSocket,
  message: ClientToServerMessage,
  connectionId: string,
): Promise<void> {
  const handler = handlers.get(message.type);

  if (!handler) {
    logger.warn`Unknown message type: ${message.type}`;
    sendError(ws, 'NOT_IMPLEMENTED', `Unknown message type: "${message.type}"`);
    return;
  }

  // Pre-dispatch session resolution
  try {
    if (!SESSION_EXEMPT.has(message.type)) {
      if (SESSION_TOUCH.has(message.type)) {
        await touchSession();
      } else {
        await resolveSession();
      }
    }
  } catch (err) {
    logger.error`Session resolution failed for ${message.type}: ${err}`;
    // Continue to handler even if session resolution fails — some handlers
    // (like repos:list, dashboard:request) can function without a session
  }

  try {
    const result = handler(ws, message.data, connectionId);

    // If the handler returns a Promise, catch any async errors
    if (result instanceof Promise) {
      await result;
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Handler error';
    logger.error`Handler error for ${message.type}: ${errorMessage}`;
    sendError(ws, 'INTERNAL_ERROR', errorMessage, { messageType: message.type });
  }
}
