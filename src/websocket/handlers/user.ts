// WebSocket handlers for user-related messages from Electron clients.
// Handles user:idle_start and user:idle_end. user:explain is stubbed for a later phase.

import type { WebSocket as WsWebSocket } from 'ws';

import { getDatabase } from '../../database/db.js';
import { logAction } from '../../logger/action-log.js';
import type { ActionType } from '../../types/domain.js';
import type { UserIdleEndData, UserIdleStartData } from '../../types/websocket.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Logs an action to the database, swallowing any errors to avoid
 * disrupting the main handler flow.
 */
function safeLogAction(actionType: ActionType, data?: Record<string, unknown>): void {
  const db = getDatabase();
  if (db) {
    logAction(db, 0, actionType, data).catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error(`[ws-handler:user] Failed to log action "${actionType}":`, err);
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
 * Stub — will be implemented in a later phase (UI-APIs: Explain This).
 */
export function handleUserExplain(_ws: WsWebSocket, _data: unknown, _connectionId: string): void {
  // TODO: Implement in Explain This phase — will use _data as UserExplainData
  // eslint-disable-next-line no-console
  console.warn('[ws-handler:user] user:explain not yet implemented');
}
