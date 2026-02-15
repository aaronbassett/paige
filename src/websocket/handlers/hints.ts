// WebSocket handler for hints:level_change messages from Electron clients.
// Logs the hint level transition as an action for Observer and dashboard tracking.

import type { WebSocket as WsWebSocket } from 'ws';

import { getLogger } from '../../logger/logtape.js';
import { getDatabase } from '../../database/db.js';

const logger = getLogger(['paige', 'ws-handler', 'hints']);
import { logAction } from '../../logger/action-log.js';
import { getActiveSessionId } from '../../mcp/session.js';
import type { ActionType } from '../../types/domain.js';
import type { HintsLevelChangeData } from '../../types/websocket.js';

// ── Helpers ──────────────────────────────────────────────────────────────

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

// ── Handlers ─────────────────────────────────────────────────────────────

/**
 * Handles `hints:level_change` messages from Electron clients.
 * Logs the hint level transition (from -> to) as a `hints_level_change` action.
 */
export function handleHintsLevelChange(
  _ws: WsWebSocket,
  data: unknown,
  _connectionId: string,
): void {
  const { from, to } = data as HintsLevelChangeData;

  safeLogAction('hints_level_change', { from, to });
}
