// WebSocket message router: dispatches client->server messages to handlers
// Stub for TDD — implementation in T171

import type { ClientToServerMessage } from '../types/websocket.js';
import type WebSocket from 'ws';

/**
 * Routes an incoming client-to-server message to the appropriate handler.
 */
export function routeMessage(
  _ws: WebSocket,
  _message: ClientToServerMessage,
  _connectionId: string,
): void {
  throw new Error('Not implemented');
}
