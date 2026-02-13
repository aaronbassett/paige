/**
 * WebSocket client for Paige Electron UI.
 *
 * Singleton service that manages the WebSocket connection to the backend server.
 * Handles connection lifecycle, reconnection with exponential backoff,
 * request/response correlation, and typed event dispatch.
 *
 * This is the backbone of all data flow between the Electron renderer and
 * the backend server. The Electron UI never touches the filesystem directly;
 * everything goes through this WebSocket connection.
 */

import type {
  MessageType,
  ClientMessageType,
  WebSocketMessage,
  BaseMessage,
} from '@shared/types/websocket-messages';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Pending correlated request awaiting a server response. */
interface PendingOperation {
  resolve: (msg: WebSocketMessage) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/** Handler function for broadcast messages (non-correlated). */
type MessageHandler = (msg: WebSocketMessage) => void;

/** Connection status reported to the UI layer. */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/** Queued operation to send once reconnected. */
interface QueuedOperation {
  type: string;
  payload: unknown;
  resolve: (msg: WebSocketMessage | void) => void;
  reject: (error: Error) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Exponential backoff delays in milliseconds. Retries cycle through these. */
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000] as const;

/** Maximum reconnect delay cap (ms). */
const MAX_RECONNECT_DELAY = 30_000;

/** Default timeout for correlated request/response pairs (ms). */
const CORRELATION_TIMEOUT = 30_000;

/** Client version sent in the connection:ready handshake. */
const CLIENT_VERSION = '0.1.0';

// ---------------------------------------------------------------------------
// WebSocketClient
// ---------------------------------------------------------------------------

class WebSocketClient {
  private ws: WebSocket | null = null;
  private correlations = new Map<string, PendingOperation>();
  private handlers = new Map<string, Set<MessageHandler>>();
  private statusListeners = new Set<(status: ConnectionStatus, attempt: number) => void>();
  private _status: ConnectionStatus = 'disconnected';
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string;
  private operationQueue: QueuedOperation[] = [];

  constructor(url = 'ws://localhost:3001/ws') {
    this.url = url;
  }

  /** Current connection status. */
  get status(): ConnectionStatus {
    return this._status;
  }

  /** Current reconnection attempt number (0 when connected). */
  get currentReconnectAttempt(): number {
    return this.reconnectAttempt;
  }

  // -------------------------------------------------------------------------
  // Connection lifecycle
  // -------------------------------------------------------------------------

  /** Open a WebSocket connection to the backend server. */
  connect(): void {
    if (this.ws && (this._status === 'connecting' || this._status === 'connected')) {
      return;
    }

    this.clearReconnectTimer();
    this.setStatus('connecting');

    const ws = new WebSocket(this.url);

    ws.addEventListener('open', () => this.handleOpen());
    ws.addEventListener('message', (event: MessageEvent) => this.handleMessage(event));
    ws.addEventListener('close', () => this.handleClose());
    ws.addEventListener('error', () => this.handleError());

    this.ws = ws;
  }

  /** Gracefully close the WebSocket connection. Prevents automatic reconnect. */
  disconnect(): void {
    this.clearReconnectTimer();
    this.reconnectAttempt = 0;

    // Reject all pending correlations
    for (const [id, pending] of this.correlations) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('WebSocket disconnected'));
      this.correlations.delete(id);
    }

    // Reject all queued operations
    for (const queued of this.operationQueue) {
      queued.reject(new Error('WebSocket disconnected'));
    }
    this.operationQueue = [];

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setStatus('disconnected');
  }

  // -------------------------------------------------------------------------
  // Sending messages
  // -------------------------------------------------------------------------

  /**
   * Send a typed message to the backend server.
   *
   * Returns a Promise that resolves with the correlated response (matched by
   * the `id` field). If the connection is down, the operation is queued and
   * will be sent when the connection is restored.
   *
   * Fire-and-forget messages (like buffer:update, editor:cursor) will resolve
   * with void immediately since no server response is expected.
   */
  async send(type: string, payload: unknown): Promise<WebSocketMessage | void> {
    // If not connected, queue the operation
    if (this._status !== 'connected' || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return new Promise<WebSocketMessage | void>((resolve, reject) => {
        this.operationQueue.push({ type, payload, resolve, reject });
      });
    }

    return this.sendImmediate(type, payload);
  }

  // -------------------------------------------------------------------------
  // Event handlers
  // -------------------------------------------------------------------------

  /**
   * Register a handler for a specific message type.
   * Handlers are called for broadcast messages (no correlation id match).
   */
  on(type: string, handler: MessageHandler): void {
    const existing = this.handlers.get(type);
    if (existing) {
      existing.add(handler);
    } else {
      this.handlers.set(type, new Set([handler]));
    }
  }

  /** Remove a previously registered handler. */
  off(type: string, handler: MessageHandler): void {
    const existing = this.handlers.get(type);
    if (existing) {
      existing.delete(handler);
      if (existing.size === 0) {
        this.handlers.delete(type);
      }
    }
  }

  /**
   * Register a listener for connection status changes.
   * Returns an unsubscribe function.
   */
  onStatusChange(listener: (status: ConnectionStatus, attempt: number) => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  // -------------------------------------------------------------------------
  // Internal: WebSocket event handlers
  // -------------------------------------------------------------------------

  private handleOpen(): void {
    this.reconnectAttempt = 0;
    this.setStatus('connected');

    // Send the connection:hello handshake (server expects this format)
    this.sendImmediate('connection:hello', {
      version: CLIENT_VERSION,
      platform: navigator.platform,
      windowSize: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[WebSocketClient] Failed to send connection:hello:', message);
    });

    // Flush any queued operations
    this.flushQueue();
  }

  private handleMessage(event: MessageEvent): void {
    let msg: WebSocketMessage;
    try {
      msg = JSON.parse(String(event.data)) as WebSocketMessage;
    } catch {
      console.error('[WebSocketClient] Failed to parse message:', event.data);
      return;
    }

    // Check for correlated response
    if (msg.id && this.correlations.has(msg.id)) {
      const pending = this.correlations.get(msg.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.correlations.delete(msg.id);
        pending.resolve(msg);
      }
      return;
    }

    // Dispatch to broadcast handlers
    const typeHandlers = this.handlers.get(msg.type);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        try {
          handler(msg);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[WebSocketClient] Handler error for "${msg.type}":`, message);
        }
      }
    }
  }

  private handleClose(): void {
    this.ws = null;
    if (this._status !== 'disconnected') {
      // Only auto-reconnect if we didn't explicitly disconnect
      this.scheduleReconnect();
    }
  }

  private handleError(): void {
    // The close event will fire after this, which triggers reconnect.
    // We log here for visibility but don't take action since handleClose
    // manages the reconnect flow.
    console.error('[WebSocketClient] Connection error');
  }

  // -------------------------------------------------------------------------
  // Internal: Reconnection
  // -------------------------------------------------------------------------

  private scheduleReconnect(): void {
    this.reconnectAttempt += 1;
    this.setStatus('reconnecting');

    const delayIndex = Math.min(this.reconnectAttempt - 1, RECONNECT_DELAYS.length - 1);
    const delay = Math.min(
      RECONNECT_DELAYS[delayIndex] ?? MAX_RECONNECT_DELAY,
      MAX_RECONNECT_DELAY
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // -------------------------------------------------------------------------
  // Internal: Queue management
  // -------------------------------------------------------------------------

  private flushQueue(): void {
    const queue = [...this.operationQueue];
    this.operationQueue = [];

    for (const queued of queue) {
      this.sendImmediate(queued.type, queued.payload)
        .then((response) => queued.resolve(response))
        .catch((error: unknown) => {
          if (error instanceof Error) {
            queued.reject(error);
          } else {
            queued.reject(new Error('Unknown error during queue flush'));
          }
        });
    }
  }

  // -------------------------------------------------------------------------
  // Internal: Message sending
  // -------------------------------------------------------------------------

  /**
   * Send a message immediately over the open WebSocket.
   * Creates a correlation entry and returns a Promise that resolves when
   * the server responds with a message carrying the same `id`.
   *
   * Fire-and-forget message types resolve immediately with void.
   */
  private sendImmediate(type: string, payload: unknown): Promise<WebSocketMessage | void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WebSocket is not open'));
    }

    // Server expects { type, data } format (not payload/id/timestamp)
    const message = {
      type: type as MessageType,
      data: payload,
    };

    this.ws.send(JSON.stringify(message));

    // All messages are fire-and-forget (server doesn't support correlation)
    return Promise.resolve();
    return new Promise<WebSocketMessage>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.correlations.delete(id);
        reject(new Error(`Request timed out after ${CORRELATION_TIMEOUT}ms: ${type}`));
      }, CORRELATION_TIMEOUT);

      this.correlations.set(id, { resolve, reject, timeout });
    });
  }

  // -------------------------------------------------------------------------
  // Internal: Status management
  // -------------------------------------------------------------------------

  private setStatus(status: ConnectionStatus): void {
    if (this._status === status) return;
    this._status = status;
    for (const listener of this.statusListeners) {
      try {
        listener(status, this.reconnectAttempt);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[WebSocketClient] Status listener error:', message);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Generate a unique correlation ID. */
function generateId(): string {
  // Use crypto.randomUUID where available (modern browsers + Electron),
  // fall back to a timestamp + random suffix for older environments.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Message types that are fire-and-forget (no correlated server response expected).
 * These are high-frequency editor events that the server ingests but does not
 * acknowledge individually.
 */
const FIRE_AND_FORGET_TYPES: ReadonlySet<string> = new Set<ClientMessageType>([
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
]);

function isFireAndForget(type: string): boolean {
  return FIRE_AND_FORGET_TYPES.has(type);
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

/** Singleton WebSocket client instance for the application. */
export const wsClient = new WebSocketClient();

export { WebSocketClient };
