/**
 * WebSocket handlers for terminal lifecycle messages.
 *
 * Tracks basic terminal state (ready, dimensions) per connection.
 * The actual PTY runs in the Electron main process — these handlers
 * just let the backend know about terminal status for the Observer.
 */

import type { WebSocket as WsWebSocket } from 'ws';
import type { TerminalReadyData, TerminalResizeData } from '../../types/websocket.js';

// ── In-Memory Terminal State ─────────────────────────────────────────────────

interface TerminalState {
  ready: boolean;
  cols: number;
  rows: number;
}

/** Per-connection terminal state. */
const terminalStates = new Map<string, TerminalState>();

// ── Handlers ────────────────────────────────────────────────────────────────

export function handleTerminalReady(_ws: WsWebSocket, data: unknown, connectionId: string): void {
  const { cols, rows } = data as TerminalReadyData;
  terminalStates.set(connectionId, { ready: true, cols, rows });
}

export function handleTerminalResize(_ws: WsWebSocket, data: unknown, connectionId: string): void {
  const { cols, rows } = data as TerminalResizeData;
  const existing = terminalStates.get(connectionId);
  if (existing) {
    existing.cols = cols;
    existing.rows = rows;
  } else {
    terminalStates.set(connectionId, { ready: true, cols, rows });
  }
}

export function handleTerminalInput(_ws: WsWebSocket, _data: unknown, _connectionId: string): void {
  // No-op for basic state tracking.
  // Future: track command patterns for Observer.
}

// ── Query API ───────────────────────────────────────────────────────────────

/** Returns terminal state for a connection, or null if not ready. */
export function getTerminalState(connectionId: string): TerminalState | null {
  return terminalStates.get(connectionId) ?? null;
}
