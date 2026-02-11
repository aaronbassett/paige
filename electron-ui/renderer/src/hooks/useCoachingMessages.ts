/**
 * React hook for managing coaching messages in the Paige Electron UI.
 *
 * Listens for `coaching:message` and `coaching:clear` WebSocket messages,
 * maintains the active set of coaching messages, and determines rendering
 * mode (toast vs. anchored balloon/icon) based on message source and anchor.
 *
 * Lifecycle:
 *   1. `coaching:message` arrives via WebSocket
 *   2. If the message has an anchor -> stored for overlay rendering
 *   3. If no anchor -> shown immediately as a toast via EditorToast
 *   4. `coaching:clear` removes specific or all messages
 *   5. User can dismiss or expand individual messages
 *
 * Usage:
 * ```tsx
 * function IDE() {
 *   const { messages, dismissMessage, dismissAllCoaching, expandedIds, expandMessage } =
 *     useCoachingMessages();
 *
 *   return (
 *     <CoachingOverlay
 *       messages={messages.filter(m => m.anchor)}
 *       expandedIds={expandedIds}
 *       onDismiss={dismissMessage}
 *       onExpand={expandMessage}
 *       // ...other props
 *     />
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import type { CoachingMessage } from '@shared/types/entities';
import type {
  WebSocketMessage,
  CoachingMessageMessage,
  CoachingClearMessage,
} from '@shared/types/websocket-messages';
import {
  showCoachingToast,
  dismissCoachingToast,
  dismissAllCoachingToasts,
} from '../components/Hints/EditorToast';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseCoachingMessagesReturn {
  /** All active coaching messages (not yet dismissed). */
  messages: CoachingMessage[];
  /** Dismiss a specific message by ID. Also dismisses any associated toast. */
  dismissMessage: (messageId: string) => void;
  /** Dismiss all non-review coaching messages and their toasts. */
  dismissAllCoaching: () => void;
  /** Set of messageIds manually expanded from collapsed icons. */
  expandedIds: ReadonlySet<string>;
  /** Expand a collapsed icon to full balloon (permanently for this message). */
  expandMessage: (messageId: string) => void;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useCoachingMessages(): UseCoachingMessagesReturn {
  const { on } = useWebSocket();
  const [messages, setMessages] = useState<CoachingMessage[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  // -------------------------------------------------------------------------
  // WebSocket handlers: coaching:message, coaching:clear
  // -------------------------------------------------------------------------

  useEffect(() => {
    const unsubMessage = on('coaching:message', (msg: WebSocketMessage) => {
      const { payload } = msg as CoachingMessageMessage;

      const newMsg: CoachingMessage = {
        messageId: payload.messageId,
        message: payload.message,
        type: payload.type,
        source: payload.source,
        ...(payload.anchor ? { anchor: payload.anchor } : {}),
      };

      setMessages((prev) => {
        // Deduplicate by messageId
        if (prev.some((m) => m.messageId === payload.messageId)) return prev;
        return [...prev, newMsg];
      });

      // If unanchored, show as toast immediately
      if (!payload.anchor) {
        showCoachingToast({
          messageId: payload.messageId,
          message: payload.message,
          type: payload.type,
        });
      }
    });

    const unsubClear = on('coaching:clear', (msg: WebSocketMessage) => {
      const { payload } = msg as CoachingClearMessage;

      if (payload.messageIds && payload.messageIds.length > 0) {
        setMessages((prev) =>
          prev.filter((m) => !payload.messageIds!.includes(m.messageId)),
        );
        payload.messageIds.forEach((id) => dismissCoachingToast(id));
      } else {
        setMessages([]);
        dismissAllCoachingToasts();
      }
    });

    // Phase transition: clear coaching balloons and toasts (but NOT review comments).
    const unsubPhaseTransition = on('phase:transition', () => {
      setMessages([]);
      setExpandedIds(new Set());
      dismissAllCoachingToasts();
    });

    return () => {
      unsubMessage();
      unsubClear();
      unsubPhaseTransition();
    };
  }, [on]);

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  const dismissMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.messageId !== messageId));
    dismissCoachingToast(messageId);
  }, []);

  const dismissAllCoaching = useCallback(() => {
    setMessages([]);
    dismissAllCoachingToasts();
    setExpandedIds(new Set());
  }, []);

  const expandMessage = useCallback((messageId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.add(messageId);
      return next;
    });
  }, []);

  return {
    messages,
    dismissMessage,
    dismissAllCoaching,
    expandedIds,
    expandMessage,
  };
}
