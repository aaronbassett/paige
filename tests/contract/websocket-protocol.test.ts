import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import WebSocket from 'ws';
import type { AddressInfo } from 'node:net';
import { createWebSocketServer, broadcast } from '../../src/websocket/server.js';
import type {
  ConnectionHelloMessage,
  ConnectionInitData,
  ConnectionErrorData,
  ServerToClientMessage,
} from '../../src/types/websocket.js';

/**
 * Contract tests for the WebSocket protocol (Backend <-> Electron).
 *
 * These tests validate that the WebSocket server implementation conforms
 * to the contract defined in specs/002-backend-server/contracts/websocket.json.
 *
 * Verified protocol invariants:
 *   1. WebSocket server accepts connections at /ws path
 *   2. Messages follow the { type, data } JSON envelope
 *   3. connection:hello -> connection:init handshake
 *   4. Unknown message types handled gracefully (no crash)
 *   5. Malformed JSON handled gracefully (connection stays open)
 *   6. Multiple simultaneous client connections
 *   7. Broadcast sends to all connected clients
 *
 * Written TDD-style: these tests FAIL until src/websocket/server.ts is implemented.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Create an HTTP server on an OS-assigned port and attach the WebSocket server. */
function createTestServer(): Promise<{
  httpServer: http.Server;
  wsHandle: ReturnType<typeof createWebSocketServer>;
  url: string;
}> {
  return new Promise((resolve, reject) => {
    const httpServer = http.createServer();
    const wsHandle = createWebSocketServer(httpServer);

    httpServer.once('error', reject);
    httpServer.listen(0, () => {
      httpServer.removeListener('error', reject);
      const address = httpServer.address() as AddressInfo;
      const url = `ws://127.0.0.1:${String(address.port)}/ws`;
      resolve({ httpServer, wsHandle, url });
    });
  });
}

/** Close an HTTP server gracefully. */
function closeServer(httpServer: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    httpServer.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/** Connect a WebSocket client to the given URL and wait for the connection to open. */
function connectClient(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once('open', () => {
      ws.removeListener('error', reject);
      resolve(ws);
    });
    ws.once('error', reject);
  });
}

/** Wait for the next message on a WebSocket client, parsed as JSON. */
function waitForMessage<T = unknown>(ws: WebSocket, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeListener('message', handler);
      reject(new Error(`Timed out waiting for message after ${String(timeoutMs)}ms`));
    }, timeoutMs);

    function handler(data: WebSocket.RawData): void {
      clearTimeout(timer);
      const parsed = JSON.parse(Buffer.from(data as ArrayBuffer).toString('utf-8')) as T;
      resolve(parsed);
    }

    ws.once('message', handler);
  });
}

/** Send a typed message (JSON stringified). */
function sendMessage(ws: WebSocket, message: object): void {
  ws.send(JSON.stringify(message));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('websocket protocol contract', () => {
  let httpServer: http.Server;
  let wsHandle: ReturnType<typeof createWebSocketServer>;
  let url: string;

  beforeAll(async () => {
    const result = await createTestServer();
    httpServer = result.httpServer;
    wsHandle = result.wsHandle;
    url = result.url;
  });

  afterAll(async () => {
    wsHandle.close();
    await closeServer(httpServer);
  });

  // Track clients opened in each test for cleanup
  let clients: WebSocket[] = [];

  beforeEach(() => {
    clients = [];
  });

  afterEach(() => {
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
        client.close();
      }
    }
  });

  // ── 1. Connection path ─────────────────────────────────────────────────

  describe('connection path', () => {
    it('accepts WebSocket connections at /ws path', async () => {
      const client = await connectClient(url);
      clients.push(client);

      expect(client.readyState).toBe(WebSocket.OPEN);
    });

    it('rejects WebSocket connections at non-/ws paths', async () => {
      const address = httpServer.address() as AddressInfo;
      const badUrl = `ws://127.0.0.1:${String(address.port)}/invalid`;

      await expect(connectClient(badUrl)).rejects.toThrow();
    });
  });

  // ── 2. Message envelope format ─────────────────────────────────────────

  describe('message envelope format', () => {
    it('server responses follow { type, data } JSON structure', async () => {
      const client = await connectClient(url);
      clients.push(client);

      const helloMessage: ConnectionHelloMessage = {
        type: 'connection:hello',
        data: {
          version: '1.0.0',
          platform: 'linux',
          windowSize: { width: 1920, height: 1080 },
        },
      };

      sendMessage(client, helloMessage);
      const response = await waitForMessage<Record<string, unknown>>(client);

      // Every server message must have exactly `type` (string) and `data` (object)
      expect(response).toHaveProperty('type');
      expect(response).toHaveProperty('data');
      expect(typeof response['type']).toBe('string');
      expect(typeof response['data']).toBe('object');
      expect(response['data']).not.toBeNull();
    });
  });

  // ── 3. connection:hello -> connection:init handshake ───────────────────

  describe('connection:hello handshake', () => {
    it('responds to connection:hello with connection:init', async () => {
      const client = await connectClient(url);
      clients.push(client);

      const helloMessage: ConnectionHelloMessage = {
        type: 'connection:hello',
        data: {
          version: '1.0.0',
          platform: 'darwin',
          windowSize: { width: 1440, height: 900 },
        },
      };

      sendMessage(client, helloMessage);
      const response = await waitForMessage<{ type: string; data: ConnectionInitData }>(client);

      expect(response.type).toBe('connection:init');
    });

    it('connection:init data contains sessionId string', async () => {
      const client = await connectClient(url);
      clients.push(client);

      sendMessage(client, {
        type: 'connection:hello',
        data: {
          version: '1.0.0',
          platform: 'linux',
          windowSize: { width: 1920, height: 1080 },
        },
      });

      const response = await waitForMessage<{ type: string; data: ConnectionInitData }>(client);

      expect(typeof response.data.sessionId).toBe('string');
    });

    it('connection:init data contains capabilities object', async () => {
      const client = await connectClient(url);
      clients.push(client);

      sendMessage(client, {
        type: 'connection:hello',
        data: {
          version: '1.0.0',
          platform: 'linux',
          windowSize: { width: 1920, height: 1080 },
        },
      });

      const response = await waitForMessage<{ type: string; data: ConnectionInitData }>(client);

      expect(response.data.capabilities).toBeDefined();
      expect(typeof response.data.capabilities.chromadb_available).toBe('boolean');
      expect(typeof response.data.capabilities.gh_cli_available).toBe('boolean');
    });

    it('connection:init data contains featureFlags object', async () => {
      const client = await connectClient(url);
      clients.push(client);

      sendMessage(client, {
        type: 'connection:hello',
        data: {
          version: '1.0.0',
          platform: 'linux',
          windowSize: { width: 1920, height: 1080 },
        },
      });

      const response = await waitForMessage<{ type: string; data: ConnectionInitData }>(client);

      expect(response.data.featureFlags).toBeDefined();
      expect(typeof response.data.featureFlags.observer_enabled).toBe('boolean');
      expect(typeof response.data.featureFlags.practice_mode_enabled).toBe('boolean');
    });
  });

  // ── 4. Unknown message type handling ───────────────────────────────────

  describe('unknown message type handling', () => {
    it('responds with connection:error for unknown message types', async () => {
      const client = await connectClient(url);
      clients.push(client);

      sendMessage(client, {
        type: 'nonexistent:message_type',
        data: { some: 'payload' },
      });

      const response = await waitForMessage<{ type: string; data: ConnectionErrorData }>(client);

      expect(response.type).toBe('connection:error');
      expect(response.data.code).toBe('NOT_IMPLEMENTED');
      expect(typeof response.data.message).toBe('string');
      expect(response.data.message.length).toBeGreaterThan(0);
    });

    it('connection stays open after unknown message type', async () => {
      const client = await connectClient(url);
      clients.push(client);

      // Send unknown type
      sendMessage(client, {
        type: 'totally:unknown',
        data: {},
      });

      // Wait for the error response
      await waitForMessage(client);

      // Connection should still be open
      expect(client.readyState).toBe(WebSocket.OPEN);

      // Verify we can still communicate — send a valid hello
      sendMessage(client, {
        type: 'connection:hello',
        data: {
          version: '1.0.0',
          platform: 'linux',
          windowSize: { width: 1920, height: 1080 },
        },
      });

      const response = await waitForMessage<{ type: string }>(client);
      expect(response.type).toBe('connection:init');
    });
  });

  // ── 5. Malformed JSON handling ─────────────────────────────────────────

  describe('malformed JSON handling', () => {
    it('responds with connection:error for malformed JSON', async () => {
      const client = await connectClient(url);
      clients.push(client);

      // Send raw invalid JSON
      client.send('this is not valid json {{{');

      const response = await waitForMessage<{ type: string; data: ConnectionErrorData }>(client);

      expect(response.type).toBe('connection:error');
      expect(response.data.code).toBe('INVALID_MESSAGE');
      expect(typeof response.data.message).toBe('string');
    });

    it('connection stays open after malformed JSON', async () => {
      const client = await connectClient(url);
      clients.push(client);

      // Send garbage
      client.send('}}not json at all{{');

      // Wait for error response
      await waitForMessage(client);

      // Connection should still be open
      expect(client.readyState).toBe(WebSocket.OPEN);

      // Verify communication still works
      sendMessage(client, {
        type: 'connection:hello',
        data: {
          version: '1.0.0',
          platform: 'linux',
          windowSize: { width: 1920, height: 1080 },
        },
      });

      const response = await waitForMessage<{ type: string }>(client);
      expect(response.type).toBe('connection:init');
    });

    it('responds with connection:error for JSON missing type field', async () => {
      const client = await connectClient(url);
      clients.push(client);

      // Valid JSON but missing required `type` field
      sendMessage(client, { data: { some: 'payload' } });

      const response = await waitForMessage<{ type: string; data: ConnectionErrorData }>(client);

      expect(response.type).toBe('connection:error');
      expect(response.data.code).toBe('INVALID_MESSAGE');
    });

    it('responds with connection:error for JSON missing data field', async () => {
      const client = await connectClient(url);
      clients.push(client);

      // Valid JSON but missing required `data` field
      sendMessage(client, { type: 'connection:hello' });

      const response = await waitForMessage<{ type: string; data: ConnectionErrorData }>(client);

      expect(response.type).toBe('connection:error');
      expect(response.data.code).toBe('INVALID_MESSAGE');
    });
  });

  // ── 6. Multiple simultaneous clients ───────────────────────────────────

  describe('multiple simultaneous clients', () => {
    it('accepts multiple WebSocket connections simultaneously', async () => {
      const client1 = await connectClient(url);
      const client2 = await connectClient(url);
      const client3 = await connectClient(url);
      clients.push(client1, client2, client3);

      expect(client1.readyState).toBe(WebSocket.OPEN);
      expect(client2.readyState).toBe(WebSocket.OPEN);
      expect(client3.readyState).toBe(WebSocket.OPEN);
    });

    it('each client receives independent responses', async () => {
      const client1 = await connectClient(url);
      const client2 = await connectClient(url);
      clients.push(client1, client2);

      // Both clients send hello
      sendMessage(client1, {
        type: 'connection:hello',
        data: {
          version: '1.0.0',
          platform: 'darwin',
          windowSize: { width: 1440, height: 900 },
        },
      });

      sendMessage(client2, {
        type: 'connection:hello',
        data: {
          version: '2.0.0',
          platform: 'win32',
          windowSize: { width: 1920, height: 1080 },
        },
      });

      const [response1, response2] = await Promise.all([
        waitForMessage<{ type: string; data: ConnectionInitData }>(client1),
        waitForMessage<{ type: string; data: ConnectionInitData }>(client2),
      ]);

      // Both should get connection:init responses
      expect(response1.type).toBe('connection:init');
      expect(response2.type).toBe('connection:init');
    });

    it('one client disconnecting does not affect others', async () => {
      const client1 = await connectClient(url);
      const client2 = await connectClient(url);
      clients.push(client1, client2);

      // Close client1
      client1.close();
      await new Promise<void>((resolve) => {
        client1.once('close', () => resolve());
      });

      // client2 should still work
      expect(client2.readyState).toBe(WebSocket.OPEN);

      sendMessage(client2, {
        type: 'connection:hello',
        data: {
          version: '1.0.0',
          platform: 'linux',
          windowSize: { width: 1920, height: 1080 },
        },
      });

      const response = await waitForMessage<{ type: string }>(client2);
      expect(response.type).toBe('connection:init');
    });
  });

  // ── 7. Broadcast function ─────────────────────────────────────────────

  describe('broadcast', () => {
    it('sends a message to all connected clients', async () => {
      const client1 = await connectClient(url);
      const client2 = await connectClient(url);
      const client3 = await connectClient(url);
      clients.push(client1, client2, client3);

      const broadcastMessage: ServerToClientMessage = {
        type: 'coaching:message',
        data: {
          message: 'Keep going, you are doing great!',
          type: 'info',
        },
      };

      // Small delay to ensure all connections are fully registered
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 50);
      });

      broadcast(broadcastMessage);

      const [msg1, msg2, msg3] = await Promise.all([
        waitForMessage<{ type: string; data: { message: string } }>(client1),
        waitForMessage<{ type: string; data: { message: string } }>(client2),
        waitForMessage<{ type: string; data: { message: string } }>(client3),
      ]);

      // All three clients should receive the same broadcast message
      expect(msg1.type).toBe('coaching:message');
      expect(msg2.type).toBe('coaching:message');
      expect(msg3.type).toBe('coaching:message');

      expect(msg1.data.message).toBe('Keep going, you are doing great!');
      expect(msg2.data.message).toBe('Keep going, you are doing great!');
      expect(msg3.data.message).toBe('Keep going, you are doing great!');
    });

    it('broadcast message follows { type, data } envelope', async () => {
      const client = await connectClient(url);
      clients.push(client);

      const broadcastMessage: ServerToClientMessage = {
        type: 'observer:status',
        data: {
          active: true,
          muted: false,
        },
      };

      // Small delay to ensure connection is fully registered
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 50);
      });

      broadcast(broadcastMessage);

      const received = await waitForMessage<Record<string, unknown>>(client);

      expect(received).toHaveProperty('type');
      expect(received).toHaveProperty('data');
      expect(typeof received['type']).toBe('string');
      expect(typeof received['data']).toBe('object');
      expect(received['data']).not.toBeNull();
    });

    it('does not send to clients that have disconnected', async () => {
      const client1 = await connectClient(url);
      const client2 = await connectClient(url);
      clients.push(client1, client2);

      // Disconnect client1 and wait for close
      client1.close();
      await new Promise<void>((resolve) => {
        client1.once('close', () => resolve());
      });

      // Small delay to ensure the server has cleaned up client1
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 50);
      });

      const broadcastMessage: ServerToClientMessage = {
        type: 'coaching:message',
        data: {
          message: 'Test broadcast after disconnect',
          type: 'info',
        },
      };

      broadcast(broadcastMessage);

      // client2 should receive the message
      const msg = await waitForMessage<{ type: string }>(client2);
      expect(msg.type).toBe('coaching:message');

      // client1 should NOT have received anything (it is closed)
      // This is implicitly verified by client1 being closed,
      // but we can also verify no error was thrown during broadcast
      expect(client1.readyState).toBe(WebSocket.CLOSED);
    });
  });
});
