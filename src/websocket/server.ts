// WebSocket server: upgrade on /ws, connection tracking, broadcast, sendToClient
// Implementation for T169, T181

import { randomUUID } from 'node:crypto';
import type { Server, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket as WsWebSocket } from 'ws';
import { ZodError } from 'zod';
import { routeMessage } from './router.js';
import { validateClientMessage } from './schemas.js';
import type {
  ServerToClientMessage,
  ClientToServerMessage,
  ConnectionErrorData,
} from '../types/websocket.js';

/** Handle for the WebSocket server lifecycle. */
export interface WebSocketServerHandle {
  /** Close the WebSocket server and all connections. */
  close: () => void;
}

// ── Module-Level State ──────────────────────────────────────────────────────

/** Map of connectionId -> WebSocket for all connected clients. */
const clients = new Map<string, WsWebSocket>();

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Sends a connection:error message to a single WebSocket client.
 */
function sendError(
  ws: WsWebSocket,
  code: ConnectionErrorData['code'],
  message: string,
  context?: Record<string, unknown>,
): void {
  const errorMsg = { type: 'connection:error', data: { code, message, context } };
  if (ws.readyState === WsWebSocket.OPEN) {
    ws.send(JSON.stringify(errorMsg));
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Creates a WebSocket server attached to the given HTTP server.
 * Handles upgrade requests at the /ws path only.
 * Connections on any other path receive a 404 response.
 */
export function createWebSocketServer(server: Server): WebSocketServerHandle {
  const wss = new WebSocketServer({ noServer: true });

  // Handle HTTP upgrade requests — only accept /ws path
  server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

    if (url.pathname !== '/ws') {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  // Handle new WebSocket connections
  wss.on('connection', (ws: WsWebSocket) => {
    const connectionId = randomUUID();
    clients.set(connectionId, ws);

    ws.on('message', (rawData: Buffer | ArrayBuffer | Buffer[]) => {
      // Parse the raw message as a UTF-8 string
      let text: string;
      if (Buffer.isBuffer(rawData)) {
        text = rawData.toString('utf-8');
      } else if (rawData instanceof ArrayBuffer) {
        text = Buffer.from(rawData).toString('utf-8');
      } else {
        // Buffer[] — concatenate
        text = Buffer.concat(rawData).toString('utf-8');
      }

      // Attempt to parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        sendError(ws, 'INVALID_MESSAGE', 'Failed to parse message as JSON');
        return;
      }

      // Validate message envelope and data payload with Zod
      let validatedMessage: { type: string; data: unknown };
      try {
        validatedMessage = validateClientMessage(parsed);
      } catch (err) {
        if (err instanceof ZodError) {
          const firstError = err.issues[0];
          const field = firstError?.path.join('.') ?? 'unknown';
          const message = `Invalid message: ${field} ${firstError?.message ?? 'validation failed'}`;
          sendError(ws, 'INVALID_MESSAGE', message, {
            validation_errors: err.issues,
          });
        } else {
          sendError(ws, 'INVALID_MESSAGE', 'Message validation failed');
        }
        return;
      }

      // Route to the appropriate handler (validated message is safe to cast)
      routeMessage(ws, validatedMessage as ClientToServerMessage, connectionId);
    });

    ws.on('close', () => {
      clients.delete(connectionId);
    });

    ws.on('error', () => {
      // Remove the client on error to prevent stale entries
      clients.delete(connectionId);
    });
  });

  return {
    close: () => {
      // Close all connected clients
      for (const [id, ws] of clients) {
        ws.close();
        clients.delete(id);
      }
      wss.close();
    },
  };
}

/**
 * Broadcasts a typed message to all connected WebSocket clients.
 * Skips clients whose readyState is not OPEN.
 * @param message - Server-to-client message envelope (type + data)
 */
export function broadcast(message: ServerToClientMessage): void {
  const serialized = JSON.stringify(message);
  for (const ws of clients.values()) {
    if (ws.readyState === WsWebSocket.OPEN) {
      ws.send(serialized);
    }
  }
}

/**
 * Sends a message to a specific connected client by connectionId.
 * Silently ignores if the client is not found or not in OPEN state.
 */
export function sendToClient(connectionId: string, message: ServerToClientMessage): void {
  const ws = clients.get(connectionId);
  if (ws && ws.readyState === WsWebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Returns the number of currently connected WebSocket clients.
 * Useful for health checks.
 */
export function getConnectedClientCount(): number {
  return clients.size;
}
