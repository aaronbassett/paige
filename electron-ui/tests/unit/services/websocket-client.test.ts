/**
 * Unit tests for the WebSocket client and debouncer utilities.
 *
 * Tests the WebSocketClient class (connection lifecycle, message sending,
 * reconnection with exponential backoff, correlation, queuing, event dispatch)
 * and the debounce utility (delay, cancel, flush, maxWait).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketClient } from '../../../renderer/src/services/websocket-client';
import type { ConnectionStatus } from '../../../renderer/src/services/websocket-client';
import {
  debounce,
  DEBOUNCE_BUFFER_UPDATE,
  DEBOUNCE_BUFFER_MAX_WAIT,
  DEBOUNCE_EDITOR_SCROLL,
  DEBOUNCE_HINT_LEVEL,
  DEBOUNCE_IDLE_START,
} from '../../../renderer/src/services/debouncer';
import type { WebSocketMessage } from '@shared/types/websocket-messages';

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

type WSListener = (event: unknown) => void;

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState: number = MockWebSocket.CONNECTING;
  url: string;
  sent: string[] = [];

  private listeners = new Map<string, Set<WSListener>>();

  constructor(url: string) {
    this.url = url;
    // Schedule the open event on the next microtick to mimic real behavior.
    // Tests that need to control timing should use fake timers and flush manually.
  }

  addEventListener(type: string, handler: WSListener): void {
    const existing = this.listeners.get(type);
    if (existing) {
      existing.add(handler);
    } else {
      this.listeners.set(type, new Set([handler]));
    }
  }

  removeEventListener(type: string, handler: WSListener): void {
    this.listeners.get(type)?.delete(handler);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    // Real WebSocket fires 'close' asynchronously; we do NOT fire it here.
    // Tests should use simulateClose() to trigger the close event explicitly.
  }

  // -- Test helpers --

  /** Simulate the WebSocket 'open' event. */
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.emit('open', {});
  }

  /** Simulate a server message arriving. */
  simulateMessage(data: Record<string, unknown>): void {
    this.emit('message', { data: JSON.stringify(data) });
  }

  /** Simulate the WebSocket 'close' event without calling this.close(). */
  simulateClose(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close', {});
  }

  /** Simulate the WebSocket 'error' event. */
  simulateError(): void {
    this.emit('error', {});
  }

  private emit(type: string, event: unknown): void {
    const handlers = this.listeners.get(type);
    if (handlers) {
      for (const handler of handlers) {
        handler(event);
      }
    }
  }
}

// Expose the same static constants on the class so that code reading
// `WebSocket.OPEN` etc. from the global works correctly.
Object.defineProperty(MockWebSocket, 'CONNECTING', { value: 0, writable: false });
Object.defineProperty(MockWebSocket, 'OPEN', { value: 1, writable: false });
Object.defineProperty(MockWebSocket, 'CLOSING', { value: 2, writable: false });
Object.defineProperty(MockWebSocket, 'CLOSED', { value: 3, writable: false });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Capture the most recent MockWebSocket instance created via the global stub. */
let lastCreatedSocket: MockWebSocket | null = null;

function getLastSocket(): MockWebSocket {
  if (!lastCreatedSocket) throw new Error('No MockWebSocket instance was created');
  return lastCreatedSocket;
}

/**
 * Connect a fresh WebSocketClient and open the socket.
 * Returns the client and the underlying MockWebSocket instance.
 */
function connectClient(url = 'ws://localhost:8080'): {
  client: WebSocketClient;
  socket: MockWebSocket;
} {
  const client = new WebSocketClient(url);
  client.connect();
  const socket = getLastSocket();
  socket.simulateOpen();
  return { client, socket };
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
  lastCreatedSocket = null;

  // Stub the global WebSocket constructor to use MockWebSocket,
  // while also capturing the created instance for assertions.
  vi.stubGlobal(
    'WebSocket',
    class extends MockWebSocket {
      constructor(url: string) {
        super(url);
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        lastCreatedSocket = this;
      }
    },
  );

  // Provide crypto.randomUUID for id generation.
  let counter = 0;
  vi.stubGlobal('crypto', {
    randomUUID: () => `test-uuid-${++counter}`,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ===========================================================================
// WebSocket Client Tests
// ===========================================================================

describe('WebSocketClient', () => {
  // -------------------------------------------------------------------------
  // Connection lifecycle
  // -------------------------------------------------------------------------

  describe('connection lifecycle', () => {
    it('should start in disconnected status', () => {
      const client = new WebSocketClient();
      expect(client.status).toBe('disconnected');
    });

    it('should transition to connecting when connect() is called', () => {
      const client = new WebSocketClient();
      client.connect();
      expect(client.status).toBe('connecting');
    });

    it('should create a WebSocket with the provided url', () => {
      const client = new WebSocketClient('ws://custom:9999');
      client.connect();
      const socket = getLastSocket();
      expect(socket.url).toBe('ws://custom:9999');
    });

    it('should transition to connected when WebSocket opens', () => {
      const client = new WebSocketClient();
      client.connect();
      expect(client.status).toBe('connecting');
      const socket = getLastSocket();
      socket.simulateOpen();
      expect(client.status).toBe('connected');
    });

    it('should send connection:ready handshake on open', () => {
      const { socket } = connectClient();
      expect(socket.sent.length).toBeGreaterThanOrEqual(1);
      const msg = JSON.parse(socket.sent[0]!) as Record<string, unknown>;
      expect(msg.type).toBe('connection:ready');
      const payload = msg.payload as Record<string, unknown>;
      expect(payload.clientVersion).toBe('0.1.0');
      expect(payload.capabilities).toEqual(['monaco', 'xterm', 'file-tree']);
    });

    it('should be a no-op if connect() is called while already connecting', () => {
      const client = new WebSocketClient();
      client.connect();
      const firstSocket = getLastSocket();
      client.connect(); // should not create a new socket
      expect(getLastSocket()).toBe(firstSocket);
    });

    it('should be a no-op if connect() is called while already connected', () => {
      const { client, socket } = connectClient();
      const oldSocket = socket;
      client.connect(); // should not create a new socket
      expect(getLastSocket()).toBe(oldSocket);
    });

    it('should use default url ws://localhost:8080', () => {
      const client = new WebSocketClient();
      client.connect();
      const socket = getLastSocket();
      expect(socket.url).toBe('ws://localhost:8080');
    });
  });

  // -------------------------------------------------------------------------
  // Disconnect
  // -------------------------------------------------------------------------

  describe('disconnect', () => {
    it('should close the WebSocket and set status to disconnected', () => {
      const { client } = connectClient();
      client.disconnect();
      expect(client.status).toBe('disconnected');
    });

    it('should reject pending correlations on disconnect', async () => {
      const { client } = connectClient();

      // Send a correlated message (file:open is not fire-and-forget)
      const promise = client.send('file:open', { path: '/foo.ts' });
      client.disconnect();

      await expect(promise).rejects.toThrow('WebSocket disconnected');
    });

    it('should reject queued operations on disconnect', async () => {
      const client = new WebSocketClient();
      // Do not connect — operations will be queued
      const promise = client.send('file:open', { path: '/bar.ts' });
      client.disconnect();

      await expect(promise).rejects.toThrow('WebSocket disconnected');
    });

    it('should clear the operation queue on disconnect', () => {
      const client = new WebSocketClient();
      // Queue up operations (not connected)
      const p1 = client.send('file:open', { path: '/a.ts' }).catch(() => {});
      const p2 = client.send('file:open', { path: '/b.ts' }).catch(() => {});

      client.disconnect();

      // Now connect — no queued messages should be flushed
      client.connect();
      const socket = getLastSocket();
      socket.simulateOpen();

      // Only the connection:ready handshake should have been sent
      const types = socket.sent.map((s) => (JSON.parse(s) as Record<string, unknown>).type);
      expect(types).toEqual(['connection:ready']);

      return Promise.all([p1, p2]);
    });

    it('should reset reconnect attempt counter', () => {
      const { client, socket } = connectClient();
      // Force a close to start reconnection
      socket.simulateClose();
      expect(client.currentReconnectAttempt).toBe(1);

      client.disconnect();
      expect(client.currentReconnectAttempt).toBe(0);
    });

    it('should prevent auto-reconnect after explicit disconnect', () => {
      const { client } = connectClient();
      client.disconnect();

      // Advance time well past reconnect delays — no reconnect should happen
      vi.advanceTimersByTime(60_000);
      expect(client.status).toBe('disconnected');
    });
  });

  // -------------------------------------------------------------------------
  // Message sending
  // -------------------------------------------------------------------------

  describe('message sending', () => {
    it('should create correlation entry and resolve on matching response', async () => {
      const { client, socket } = connectClient();

      const promise = client.send('file:open', { path: '/hello.ts' });

      // Extract the id from the sent message
      const sentMsg = JSON.parse(socket.sent.at(-1)!) as Record<string, unknown>;
      expect(sentMsg.type).toBe('file:open');
      const correlationId = sentMsg.id as string;

      // Simulate server response with same id
      socket.simulateMessage({
        type: 'buffer:content',
        id: correlationId,
        payload: { path: '/hello.ts', content: 'hello', language: 'typescript' },
        timestamp: Date.now(),
      });

      const response = (await promise) as WebSocketMessage;
      expect(response.type).toBe('buffer:content');
    });

    it('should include id, type, payload, and timestamp in sent messages', () => {
      const { socket } = connectClient();

      // The connection:ready handshake is the first message
      const msg = JSON.parse(socket.sent[0]!) as Record<string, unknown>;
      expect(msg).toHaveProperty('id');
      expect(msg).toHaveProperty('type');
      expect(msg).toHaveProperty('payload');
      expect(msg).toHaveProperty('timestamp');
      expect(typeof msg.id).toBe('string');
      expect(typeof msg.timestamp).toBe('number');
    });

    it('should reject if WebSocket is not open when sendImmediate is called', async () => {
      const client = new WebSocketClient();
      // Not connected at all — send will queue
      const promise = client.send('file:open', { path: '/x.ts' });

      // Connect but do not open the socket
      client.connect();
      // The queued message is still pending

      client.disconnect();
      await expect(promise).rejects.toThrow('WebSocket disconnected');
    });
  });

  // -------------------------------------------------------------------------
  // Fire-and-forget
  // -------------------------------------------------------------------------

  describe('fire-and-forget messages', () => {
    const fireAndForgetTypes = [
      'buffer:update',
      'editor:cursor',
      'editor:scroll',
      'editor:selection',
      'terminal:input',
      'terminal:resize',
      'user:idle_start',
      'user:idle_end',
      'user:navigation',
      'coaching:dismiss',
      'coaching:feedback',
      'hints:level_change',
      'phase:expand_step',
    ];

    for (const type of fireAndForgetTypes) {
      it(`should resolve immediately for fire-and-forget type "${type}"`, async () => {
        const { client } = connectClient();
        const result = await client.send(type, {});
        expect(result).toBeUndefined();
      });
    }

    it('should still send the message over the wire for fire-and-forget types', () => {
      const { client, socket } = connectClient();
      client.send('buffer:update', { path: '/f.ts', content: 'x', cursorPosition: { line: 1, column: 1 } });

      // Find the buffer:update message in sent messages
      const bufferMsg = socket.sent.find((s) => {
        const parsed = JSON.parse(s) as Record<string, unknown>;
        return parsed.type === 'buffer:update';
      });
      expect(bufferMsg).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Reconnection
  // -------------------------------------------------------------------------

  describe('reconnection', () => {
    it('should set status to reconnecting after unexpected close', () => {
      const { client, socket } = connectClient();
      socket.simulateClose();
      expect(client.status).toBe('reconnecting');
    });

    it('should increment reconnect attempt on each close', () => {
      const { client, socket } = connectClient();
      expect(client.currentReconnectAttempt).toBe(0);

      socket.simulateClose();
      expect(client.currentReconnectAttempt).toBe(1);
    });

    it('should use exponential backoff delays: 1s, 2s, 4s, 8s, 16s, cap 30s', () => {
      const delays = [1000, 2000, 4000, 8000, 16000, 30000];
      const { client } = connectClient();

      // First close triggers reconnection attempt 1
      getLastSocket().simulateClose();
      expect(client.status).toBe('reconnecting');
      expect(client.currentReconnectAttempt).toBe(1);

      for (let i = 0; i < delays.length; i++) {
        // Advance just before the expected delay — should still be reconnecting
        vi.advanceTimersByTime(delays[i]! - 1);
        expect(client.status).toBe('reconnecting');

        // Advance the remaining 1ms — reconnect timer fires, calls connect()
        vi.advanceTimersByTime(1);
        expect(client.status).toBe('connecting');

        // The new socket does NOT successfully open — simulate another close
        // to trigger the next reconnect attempt with a longer delay.
        if (i < delays.length - 1) {
          getLastSocket().simulateClose();
          expect(client.status).toBe('reconnecting');
          expect(client.currentReconnectAttempt).toBe(i + 2);
        }
      }
    });

    it('should cap reconnect delay at 30 seconds for attempts beyond the array', () => {
      const { client } = connectClient();

      // Initial close
      getLastSocket().simulateClose();

      // Rapidly fail through 6 defined delays to reach the cap
      const delays = [1000, 2000, 4000, 8000, 16000, 30000];
      for (let i = 0; i < delays.length; i++) {
        vi.advanceTimersByTime(delays[i]!);
        // connect() fires, creating a new socket in 'connecting' state
        // Immediately close it to trigger the next backoff attempt
        getLastSocket().simulateClose();
      }

      // We are now at attempt 7+ — delay should be capped at 30s
      vi.advanceTimersByTime(29_999);
      expect(client.status).toBe('reconnecting');
      vi.advanceTimersByTime(1);
      expect(client.status).toBe('connecting');
    });

    it('should reset reconnect attempt counter on successful connection', () => {
      const { client, socket } = connectClient();
      socket.simulateClose();
      expect(client.currentReconnectAttempt).toBe(1);

      vi.advanceTimersByTime(1000);
      const newSocket = getLastSocket();
      newSocket.simulateOpen();

      expect(client.currentReconnectAttempt).toBe(0);
    });

    it('should not auto-reconnect after explicit disconnect', () => {
      const { client } = connectClient();
      client.disconnect();

      vi.advanceTimersByTime(60_000);
      expect(client.status).toBe('disconnected');
    });
  });

  // -------------------------------------------------------------------------
  // Operation queue
  // -------------------------------------------------------------------------

  describe('operation queue', () => {
    it('should queue operations when not connected', () => {
      const client = new WebSocketClient();
      // Not connected — send should queue
      const promise = client.send('file:open', { path: '/queued.ts' });

      // Connect and open
      client.connect();
      const socket = getLastSocket();
      socket.simulateOpen();

      // Find the queued file:open message
      const fileOpenMsg = socket.sent.find((s) => {
        const parsed = JSON.parse(s) as Record<string, unknown>;
        return parsed.type === 'file:open';
      });
      expect(fileOpenMsg).toBeDefined();

      // Resolve the promise
      const parsed = JSON.parse(fileOpenMsg!) as Record<string, unknown>;
      socket.simulateMessage({
        type: 'buffer:content',
        id: parsed.id,
        payload: { path: '/queued.ts', content: '', language: 'typescript' },
        timestamp: Date.now(),
      });

      return promise;
    });

    it('should flush queued operations on reconnect', async () => {
      const { client, socket } = connectClient();

      // Close connection
      socket.simulateClose();

      // Queue operations while disconnected
      const p1 = client.send('buffer:update', { path: '/a.ts', content: 'a', cursorPosition: { line: 1, column: 1 } });

      // Reconnect
      vi.advanceTimersByTime(1000);
      const newSocket = getLastSocket();
      newSocket.simulateOpen();

      // buffer:update is fire-and-forget, so p1 resolves immediately after flush
      const result = await p1;
      expect(result).toBeUndefined();

      // Verify the message was actually sent on the new socket
      const bufferMsg = newSocket.sent.find((s) => {
        const parsed = JSON.parse(s) as Record<string, unknown>;
        return parsed.type === 'buffer:update';
      });
      expect(bufferMsg).toBeDefined();
    });

    it('should resolve queued correlated operations after flush and server response', async () => {
      const { client, socket } = connectClient();

      // Close connection
      socket.simulateClose();

      // Queue a correlated operation while disconnected
      const promise = client.send('file:open', { path: '/queued-correlated.ts' });

      // Reconnect
      vi.advanceTimersByTime(1000);
      const newSocket = getLastSocket();
      newSocket.simulateOpen();

      // Find the queued file:open on the new socket
      const fileOpenMsg = newSocket.sent.find((s) => {
        const parsed = JSON.parse(s) as Record<string, unknown>;
        return parsed.type === 'file:open';
      });
      expect(fileOpenMsg).toBeDefined();

      const parsed = JSON.parse(fileOpenMsg!) as Record<string, unknown>;
      newSocket.simulateMessage({
        type: 'buffer:content',
        id: parsed.id,
        payload: { path: '/queued-correlated.ts', content: 'hello', language: 'typescript' },
        timestamp: Date.now(),
      });

      const response = (await promise) as WebSocketMessage;
      expect(response.type).toBe('buffer:content');
    });
  });

  // -------------------------------------------------------------------------
  // Status listeners
  // -------------------------------------------------------------------------

  describe('status listeners', () => {
    it('should fire onStatusChange listener on status transitions', () => {
      const client = new WebSocketClient();
      const statusChanges: Array<{ status: ConnectionStatus; attempt: number }> = [];

      client.onStatusChange((status, attempt) => {
        statusChanges.push({ status, attempt });
      });

      client.connect();
      expect(statusChanges).toEqual([{ status: 'connecting', attempt: 0 }]);

      const socket = getLastSocket();
      socket.simulateOpen();
      expect(statusChanges).toEqual([
        { status: 'connecting', attempt: 0 },
        { status: 'connected', attempt: 0 },
      ]);
    });

    it('should return an unsubscribe function', () => {
      const client = new WebSocketClient();
      const listener = vi.fn();
      const unsub = client.onStatusChange(listener);

      client.connect();
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      const socket = getLastSocket();
      socket.simulateOpen();

      // Listener was called once before unsubscribe, not after
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should not fire listener for same status transition', () => {
      const client = new WebSocketClient();
      const listener = vi.fn();
      client.onStatusChange(listener);

      client.connect();
      expect(listener).toHaveBeenCalledTimes(1); // -> connecting
      // Calling connect() again should be a no-op and not fire listener
      client.connect();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should support multiple listeners', () => {
      const client = new WebSocketClient();
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      client.onStatusChange(listener1);
      client.onStatusChange(listener2);

      client.connect();
      expect(listener1).toHaveBeenCalledWith('connecting', 0);
      expect(listener2).toHaveBeenCalledWith('connecting', 0);
    });

    it('should fire reconnecting status with attempt number', () => {
      const { client, socket } = connectClient();
      const statusChanges: Array<{ status: ConnectionStatus; attempt: number }> = [];

      client.onStatusChange((status, attempt) => {
        statusChanges.push({ status, attempt });
      });

      socket.simulateClose();
      expect(statusChanges).toContainEqual({ status: 'reconnecting', attempt: 1 });
    });

    it('should continue working even if a listener throws', () => {
      const client = new WebSocketClient();
      const badListener = vi.fn(() => {
        throw new Error('listener error');
      });
      const goodListener = vi.fn();

      client.onStatusChange(badListener);
      client.onStatusChange(goodListener);

      // Should not throw
      client.connect();
      expect(badListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Event dispatch (on/off)
  // -------------------------------------------------------------------------

  describe('event dispatch', () => {
    it('should call registered handlers for broadcast messages', () => {
      const { client, socket } = connectClient();
      const handler = vi.fn();

      client.on('coaching:message', handler);

      socket.simulateMessage({
        type: 'coaching:message',
        payload: { messageId: 'm1', message: 'Try this', type: 'hint', source: 'coaching' },
        timestamp: Date.now(),
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'coaching:message' }),
      );
    });

    it('should not call handlers for correlated responses', () => {
      const { client, socket } = connectClient();
      const handler = vi.fn();

      client.on('buffer:content', handler);

      // Send a correlated request
      const promise = client.send('file:open', { path: '/test.ts' });
      const sentMsg = JSON.parse(socket.sent.at(-1)!) as Record<string, unknown>;
      const id = sentMsg.id as string;

      // Simulate correlated response (has matching id)
      socket.simulateMessage({
        type: 'buffer:content',
        id,
        payload: { path: '/test.ts', content: 'content', language: 'typescript' },
        timestamp: Date.now(),
      });

      // Handler should NOT be called for correlated responses
      expect(handler).not.toHaveBeenCalled();

      return promise;
    });

    it('should remove handler with off()', () => {
      const { client, socket } = connectClient();
      const handler = vi.fn();

      client.on('observer:nudge', handler);
      client.off('observer:nudge', handler);

      socket.simulateMessage({
        type: 'observer:nudge',
        payload: { message: 'nudge' },
        timestamp: Date.now(),
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should support multiple handlers for the same type', () => {
      const { client, socket } = connectClient();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      client.on('coaching:message', handler1);
      client.on('coaching:message', handler2);

      socket.simulateMessage({
        type: 'coaching:message',
        payload: { messageId: 'm2', message: 'hint', type: 'hint', source: 'observer' },
        timestamp: Date.now(),
      });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should not call handlers for unrelated types', () => {
      const { client, socket } = connectClient();
      const handler = vi.fn();

      client.on('observer:nudge', handler);

      socket.simulateMessage({
        type: 'coaching:message',
        payload: { messageId: 'm3', message: 'x', type: 'info', source: 'coaching' },
        timestamp: Date.now(),
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle malformed JSON gracefully', () => {
      const { client, socket } = connectClient();
      const handler = vi.fn();
      client.on('coaching:message', handler);

      // Simulate raw invalid JSON
      const listeners = (socket as unknown as { listeners: Map<string, Set<WSListener>> }).listeners;
      // We need to access the message listeners directly since simulateMessage always JSON.stringifies
      const msgHandlers = listeners?.get('message');
      if (msgHandlers) {
        for (const h of msgHandlers) {
          h({ data: 'not valid json{{{' });
        }
      }

      expect(handler).not.toHaveBeenCalled();
    });

    it('should continue dispatching even if a handler throws', () => {
      const { client, socket } = connectClient();
      const badHandler = vi.fn(() => {
        throw new Error('handler error');
      });
      const goodHandler = vi.fn();

      client.on('observer:nudge', badHandler);
      client.on('observer:nudge', goodHandler);

      socket.simulateMessage({
        type: 'observer:nudge',
        payload: { message: 'test' },
        timestamp: Date.now(),
      });

      expect(badHandler).toHaveBeenCalled();
      expect(goodHandler).toHaveBeenCalled();
    });

    it('should clean up handler set when last handler is removed', () => {
      const { client } = connectClient();
      const handler = vi.fn();

      client.on('observer:nudge', handler);
      client.off('observer:nudge', handler);

      // off() should be idempotent — calling it again should not throw
      client.off('observer:nudge', handler);
    });
  });

  // -------------------------------------------------------------------------
  // Correlation timeout
  // -------------------------------------------------------------------------

  describe('correlation timeout', () => {
    it('should reject a pending request after 30 seconds', async () => {
      const { client } = connectClient();

      const promise = client.send('file:open', { path: '/timeout.ts' });

      // Advance 30 seconds
      vi.advanceTimersByTime(30_000);

      await expect(promise).rejects.toThrow('Request timed out after 30000ms: file:open');
    });

    it('should not reject if response arrives before timeout', async () => {
      const { client, socket } = connectClient();

      const promise = client.send('file:open', { path: '/fast.ts' });
      const sentMsg = JSON.parse(socket.sent.at(-1)!) as Record<string, unknown>;

      // Advance 15 seconds (half the timeout)
      vi.advanceTimersByTime(15_000);

      // Respond before timeout
      socket.simulateMessage({
        type: 'buffer:content',
        id: sentMsg.id,
        payload: { path: '/fast.ts', content: 'fast', language: 'typescript' },
        timestamp: Date.now(),
      });

      const response = (await promise) as WebSocketMessage;
      expect(response.type).toBe('buffer:content');

      // Advance past the full timeout — should not cause issues
      vi.advanceTimersByTime(20_000);
    });

    it('should clean up correlation entry on timeout', async () => {
      const { client, socket } = connectClient();

      const promise = client.send('file:open', { path: '/cleanup.ts' });
      const sentMsg = JSON.parse(socket.sent.at(-1)!) as Record<string, unknown>;
      const id = sentMsg.id as string;

      vi.advanceTimersByTime(30_000);

      // After the timeout, the promise should be rejected
      await expect(promise).rejects.toThrow();

      // If a late response arrives, it should be treated as a broadcast
      const handler = vi.fn();
      client.on('buffer:content', handler);

      socket.simulateMessage({
        type: 'buffer:content',
        id,
        payload: { path: '/cleanup.ts', content: '', language: 'typescript' },
        timestamp: Date.now(),
      });

      // Since the correlation was cleaned up, but the message has a known id
      // that is no longer in the correlations map, it falls through to broadcast.
      // The handler should be called (the id is checked against correlations first,
      // not found, then dispatched to handlers).
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('should handle WebSocket error events and reconnect via close', () => {
      const { client, socket } = connectClient();

      // Error fires first, then close
      socket.simulateError();
      socket.simulateClose();

      expect(client.status).toBe('reconnecting');
    });
  });
});

// ===========================================================================
// Debouncer Tests
// ===========================================================================

describe('debounce', () => {
  // -------------------------------------------------------------------------
  // Basic debounce
  // -------------------------------------------------------------------------

  describe('basic debounce', () => {
    it('should not call fn before the delay', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 300);

      debounced();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(299);
      expect(fn).not.toHaveBeenCalled();
    });

    it('should call fn after the delay', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 300);

      debounced();
      vi.advanceTimersByTime(300);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to the debounced function', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced('hello', 42);
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledWith('hello', 42);
    });
  });

  // -------------------------------------------------------------------------
  // Rapid calls
  // -------------------------------------------------------------------------

  describe('rapid calls', () => {
    it('should only fire the last call within the debounce window', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 200);

      debounced('first');
      vi.advanceTimersByTime(50);
      debounced('second');
      vi.advanceTimersByTime(50);
      debounced('third');

      vi.advanceTimersByTime(200);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('third');
    });

    it('should reset the timer on each call', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      vi.advanceTimersByTime(80);
      debounced(); // resets the 100ms timer
      vi.advanceTimersByTime(80);
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(20);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should allow multiple independent bursts', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      // First burst
      debounced('a');
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('a');

      // Second burst (after silence)
      debounced('b');
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith('b');
    });
  });

  // -------------------------------------------------------------------------
  // Cancel
  // -------------------------------------------------------------------------

  describe('cancel', () => {
    it('should prevent pending invocation', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 200);

      debounced();
      vi.advanceTimersByTime(100);
      debounced.cancel();
      vi.advanceTimersByTime(200);

      expect(fn).not.toHaveBeenCalled();
    });

    it('should be safe to call cancel when nothing is pending', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 200);

      // No call queued — should not throw
      debounced.cancel();
      expect(fn).not.toHaveBeenCalled();
    });

    it('should also clear the maxWait timer', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100, 500);

      debounced();
      vi.advanceTimersByTime(50);
      debounced.cancel();

      // Even after the maxWait period, fn should not fire
      vi.advanceTimersByTime(500);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Flush
  // -------------------------------------------------------------------------

  describe('flush', () => {
    it('should invoke the pending function immediately', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 1000);

      debounced('flushed');
      debounced.flush();

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('flushed');
    });

    it('should clear timers after flush so fn is not called twice', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 200);

      debounced('once');
      debounced.flush();
      vi.advanceTimersByTime(200);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should be a no-op if no invocation is pending', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 200);

      debounced.flush();
      expect(fn).not.toHaveBeenCalled();
    });

    it('should flush the last arguments when called after multiple rapid calls', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 200);

      debounced('a');
      debounced('b');
      debounced('c');
      debounced.flush();

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('c');
    });
  });

  // -------------------------------------------------------------------------
  // Max wait
  // -------------------------------------------------------------------------

  describe('maxWait', () => {
    it('should fire fn after maxWait even under continuous calls', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100, 500);

      // Simulate continuous typing for 600ms (call every 50ms)
      for (let i = 0; i < 12; i++) {
        debounced(`call-${i}`);
        vi.advanceTimersByTime(50);
      }

      // At 500ms from first call, maxWait should have fired
      expect(fn).toHaveBeenCalledTimes(1);
      // The latest args at the 500ms mark should be used
      // At 500ms, we are at iteration 10 (50*10=500), so call-9 was the last before 500ms
      expect(fn).toHaveBeenCalledWith('call-9');
    });

    it('should fire at debounce delay if no more calls come before maxWait', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100, 5000);

      debounced('single');
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('single');

      // Advancing past maxWait should not cause a second call
      vi.advanceTimersByTime(5000);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should reset the maxWait timer after a burst fires', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100, 300);

      // First burst: fire at maxWait
      debounced('a');
      vi.advanceTimersByTime(50);
      debounced('b');
      vi.advanceTimersByTime(50);
      debounced('c');
      vi.advanceTimersByTime(50);
      debounced('d');
      vi.advanceTimersByTime(150); // total 300ms from first call = maxWait fires

      expect(fn).toHaveBeenCalledTimes(1);

      // Second burst should work independently
      debounced('e');
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith('e');
    });

    it('should not fire at maxWait if cancel was called', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100, 300);

      debounced('x');
      vi.advanceTimersByTime(50);
      debounced.cancel();

      vi.advanceTimersByTime(300);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Exported constants
  // -------------------------------------------------------------------------

  describe('exported timing constants', () => {
    it('should export DEBOUNCE_BUFFER_UPDATE as 300', () => {
      expect(DEBOUNCE_BUFFER_UPDATE).toBe(300);
    });

    it('should export DEBOUNCE_BUFFER_MAX_WAIT as 5000', () => {
      expect(DEBOUNCE_BUFFER_MAX_WAIT).toBe(5000);
    });

    it('should export DEBOUNCE_EDITOR_SCROLL as 200', () => {
      expect(DEBOUNCE_EDITOR_SCROLL).toBe(200);
    });

    it('should export DEBOUNCE_HINT_LEVEL as 200', () => {
      expect(DEBOUNCE_HINT_LEVEL).toBe(200);
    });

    it('should export DEBOUNCE_IDLE_START as 5000', () => {
      expect(DEBOUNCE_IDLE_START).toBe(5000);
    });
  });
});
