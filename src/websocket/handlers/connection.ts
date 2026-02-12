// WebSocket handler for connection:hello messages from Electron clients.
// Responds with connection:init containing session ID, capabilities, and feature flags.

import { randomUUID } from 'node:crypto';
import { WebSocket as WsWebSocket } from 'ws';

import type { ConnectionInitData } from '../../types/websocket.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sends a typed JSON message to the client.
 * No-ops if the socket is not in the OPEN state.
 */
function send(ws: WsWebSocket, type: string, data: unknown): void {
  if (ws.readyState === WsWebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data }));
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

/**
 * Handles `connection:hello` messages from Electron clients.
 * Responds with `connection:init` containing a fresh session UUID,
 * capability flags, and feature flags.
 */
export function handleConnectionHello(
  ws: WsWebSocket,
  _data: unknown,
  _connectionId: string,
): void {
  const initData: ConnectionInitData = {
    sessionId: randomUUID(),
    capabilities: {
      chromadb_available: false,
      gh_cli_available: false,
    },
    featureFlags: {
      observer_enabled: false,
      practice_mode_enabled: false,
    },
  };

  send(ws, 'connection:init', initData);
}
