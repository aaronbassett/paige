// WebSocket handlers for editor:tab_switch and editor:selection messages from Electron clients.
// These are fire-and-forget actions that log editor activity for the Observer system.

import type { WebSocket as WsWebSocket } from 'ws';

import { getDatabase } from '../../database/db.js';
import { logAction } from '../../logger/action-log.js';
import { getActiveSessionId } from '../../mcp/session.js';
import type { ActionType } from '../../types/domain.js';
import type { EditorSelectionData, EditorTabSwitchData } from '../../types/websocket.js';

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
      // eslint-disable-next-line no-console
      console.error(`[ws-handler:editor] Failed to log action "${actionType}":`, err);
    });
  }
}

// ── Handlers ─────────────────────────────────────────────────────────────

/**
 * Handles `editor:tab_switch` messages from Electron clients.
 * Logs the tab switch action with the source and destination file paths.
 */
export function handleEditorTabSwitch(
  _ws: WsWebSocket,
  data: unknown,
  _connectionId: string,
): void {
  const { fromPath, toPath } = data as EditorTabSwitchData;

  safeLogAction('editor_tab_switch', { fromPath, toPath });
}

/**
 * Handles `editor:selection` messages from Electron clients.
 * Logs the selection action with the file path, range, and selected text.
 */
export function handleEditorSelection(
  _ws: WsWebSocket,
  data: unknown,
  _connectionId: string,
): void {
  const { path, range, selectedText } = data as EditorSelectionData;

  safeLogAction('editor_selection', { path, range, selectedText });
}
