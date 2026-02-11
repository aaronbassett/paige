// WebSocket server: upgrade on /ws, connection tracking, broadcast
// Stub for TDD — implementation in T169, T181

import type { Server } from 'node:http';
import type { ServerToClientMessage } from '../types/websocket.js';

/** Handle for the WebSocket server lifecycle. */
export interface WebSocketServerHandle {
  /** Close the WebSocket server and all connections. */
  close: () => void;
}

/**
 * Creates a WebSocket server attached to the given HTTP server.
 * Handles upgrade requests at the /ws path.
 */
export function createWebSocketServer(_server: Server): WebSocketServerHandle {
  return Promise.reject(new Error('Not implemented')) as never;
}

/**
 * Broadcasts a message to all connected WebSocket clients.
 */
export function broadcast(_message: ServerToClientMessage): void {
  throw new Error('Not implemented');
}
