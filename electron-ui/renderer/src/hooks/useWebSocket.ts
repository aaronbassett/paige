/**
 * React hook for WebSocket connectivity in the Paige Electron UI.
 *
 * Wraps the singleton WebSocketClient to provide React-friendly
 * connection status state and stable callback references for sending
 * messages and subscribing to server events.
 *
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const { status, reconnectAttempt, send, on } = useWebSocket();
 *
 *   useEffect(() => {
 *     return on('fs:tree', (msg) => {
 *       // Handle file tree update
 *     });
 *   }, [on]);
 *
 *   const handleSave = async () => {
 *     await send('file:save', { path, content });
 *   };
 *
 *   if (status === 'reconnecting') {
 *     return <div>Reconnecting (attempt {reconnectAttempt})...</div>;
 *   }
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { wsClient, type ConnectionStatus } from '../services/websocket-client';
import type { WebSocketMessage } from '@shared/types/websocket-messages';

/** Return type of the useWebSocket hook. */
export interface UseWebSocketReturn {
  /** Current connection status. */
  status: ConnectionStatus;
  /** Current reconnection attempt number (0 when connected). */
  reconnectAttempt: number;
  /** Send a typed message to the backend. Returns the correlated response. */
  send: (type: string, payload: unknown) => Promise<WebSocketMessage | void>;
  /**
   * Subscribe to a message type. Returns an unsubscribe function.
   * Call the unsubscribe function in a useEffect cleanup.
   */
  on: (type: string, handler: (msg: WebSocketMessage) => void) => () => void;
}

/**
 * React hook that manages the WebSocket connection lifecycle.
 *
 * Connects on mount and exposes reactive connection status. The underlying
 * WebSocket client is a singleton, so multiple components using this hook
 * share the same connection.
 */
export function useWebSocket(): UseWebSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>(wsClient.status);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  useEffect(() => {
    const unsubscribe = wsClient.onStatusChange((newStatus, attempt) => {
      setStatus(newStatus);
      setReconnectAttempt(attempt);
    });

    // Connect if not already connected
    if (wsClient.status === 'disconnected') {
      wsClient.connect();
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const send = useCallback(async (type: string, payload: unknown) => {
    return wsClient.send(type, payload);
  }, []);

  const on = useCallback((type: string, handler: (msg: WebSocketMessage) => void) => {
    wsClient.on(type, handler);
    return () => wsClient.off(type, handler);
  }, []);

  return { status, reconnectAttempt, send, on };
}
