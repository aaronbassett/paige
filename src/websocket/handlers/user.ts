// WebSocket handlers for user-related messages from Electron clients.
// Handles user:idle_start, user:idle_end, and user:explain.

import type { WebSocket as WsWebSocket } from 'ws';

import { getDatabase } from '../../database/db.js';
import { logAction } from '../../logger/action-log.js';
import { getLogger } from '../../logger/logtape.js';
import { getActiveSessionId } from '../../mcp/session.js';

const logger = getLogger(['paige', 'ws-handler', 'user']);
import { handleExplainThis } from '../../ui-apis/explain.js';
import { broadcast } from '../server.js';
import type { ActionType } from '../../types/domain.js';
import type { UserExplainData, UserIdleEndData, UserIdleStartData } from '../../types/websocket.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Logs an action to the database, swallowing any errors to avoid
 * disrupting the main handler flow.
 */
function safeLogAction(actionType: ActionType, data?: Record<string, unknown>): void {
  const db = getDatabase();
  const sessionId = getActiveSessionId();
  if (db !== null && sessionId !== null) {
    logAction(db, sessionId, actionType, data).catch((err: unknown) => {
      logger.error`Failed to log action "${actionType}": ${err}`;
    });
  }
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/**
 * Handles `user:idle_start` messages from Electron clients.
 * Logs the idle start event with duration threshold that triggered it.
 * No response is sent — this is a one-way client notification.
 */
export function handleUserIdleStart(_ws: WsWebSocket, data: unknown, _connectionId: string): void {
  const { durationMs } = data as UserIdleStartData;

  safeLogAction('user_idle_start', { durationMs });
}

/**
 * Handles `user:idle_end` messages from Electron clients.
 * Logs the idle end event with the total idle duration.
 * No response is sent — this is a one-way client notification.
 */
export function handleUserIdleEnd(_ws: WsWebSocket, data: unknown, _connectionId: string): void {
  const { idleDurationMs } = data as UserIdleEndData;

  safeLogAction('user_idle_end', { idleDurationMs });
}

/**
 * Handles `user:explain` messages from Electron clients.
 * Calls the Explain This API and broadcasts the response.
 */
export function handleUserExplain(_ws: WsWebSocket, data: unknown, _connectionId: string): void {
  const sessionId = getActiveSessionId();
  if (sessionId === null) return;

  const explainData = data as UserExplainData;

  void handleExplainThis(explainData, sessionId)
    .then((result) => {
      broadcast({
        type: 'explain:response',
        data: {
          title: result.title,
          explanation: result.explanation,
          phaseConnection: result.phaseConnection ?? undefined,
        },
      });
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Explain request failed';
      broadcast({ type: 'explain:error', data: { error: message } });
    });
}
