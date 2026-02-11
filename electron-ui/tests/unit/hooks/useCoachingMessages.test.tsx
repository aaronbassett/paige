/**
 * Unit tests for the useCoachingMessages hook.
 *
 * Tests cover:
 * - Receiving coaching:message with anchor adds to messages array
 * - Receiving coaching:message without anchor calls showCoachingToast
 * - Deduplicates messages by messageId
 * - dismissMessage removes message and calls dismissCoachingToast
 * - dismissAllCoaching clears all messages and toasts
 * - expandMessage adds messageId to expandedIds
 * - coaching:clear with messageIds removes specific messages
 * - coaching:clear without messageIds clears all
 * - Stable callback references across re-renders
 * - Cleanup unsubscribes on unmount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { WebSocketMessage } from '@shared/types/websocket-messages';
import { useCoachingMessages } from '../../../renderer/src/hooks/useCoachingMessages';

// ---------------------------------------------------------------------------
// Mock useWebSocket (multi-handler support)
// ---------------------------------------------------------------------------

type MessageHandler = (msg: WebSocketMessage) => void;

const handlers = new Map<string, MessageHandler[]>();

vi.mock('../../../renderer/src/hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    status: 'active' as const,
    reconnectAttempt: 0,
    send: vi.fn(),
    on: (type: string, handler: MessageHandler) => {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type)!.push(handler);
      return () => {
        const arr = handlers.get(type);
        if (arr) {
          const idx = arr.indexOf(handler);
          if (idx >= 0) arr.splice(idx, 1);
          if (arr.length === 0) handlers.delete(type);
        }
      };
    },
  }),
}));

// ---------------------------------------------------------------------------
// Mock EditorToast
// ---------------------------------------------------------------------------

const mockShowToast = vi.fn();
const mockDismissToast = vi.fn();
const mockDismissAll = vi.fn();

vi.mock('../../../renderer/src/components/Hints/EditorToast', () => ({
  showCoachingToast: (...args: unknown[]) => mockShowToast(...args),
  dismissCoachingToast: (...args: unknown[]) => mockDismissToast(...args),
  dismissAllCoachingToasts: (...args: unknown[]) => mockDismissAll(...args),
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeMessage(type: string, payload: unknown): WebSocketMessage {
  return {
    type,
    payload,
    timestamp: Date.now(),
  } as unknown as WebSocketMessage;
}

function simulateMessage(type: string, payload: unknown): void {
  const arr = handlers.get(type);
  if (arr) {
    const msg = makeMessage(type, payload);
    arr.forEach((handler) => handler(msg));
  }
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  handlers.clear();
  mockShowToast.mockReset();
  mockDismissToast.mockReset();
  mockDismissAll.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// Tests
// ===========================================================================

describe('useCoachingMessages', () => {
  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  it('should initialize with empty messages and expandedIds', () => {
    const { result } = renderHook(() => useCoachingMessages());

    expect(result.current.messages).toEqual([]);
    expect(result.current.expandedIds.size).toBe(0);
  });

  // -------------------------------------------------------------------------
  // coaching:message handling
  // -------------------------------------------------------------------------

  describe('coaching:message', () => {
    it('should add an anchored message to messages array', () => {
      const { result } = renderHook(() => useCoachingMessages());

      act(() => {
        simulateMessage('coaching:message', {
          messageId: 'msg-1',
          message: 'Consider using a guard clause here.',
          type: 'hint',
          source: 'coaching',
          anchor: {
            path: '/src/index.ts',
            startLine: 10,
            startColumn: 1,
            endLine: 10,
            endColumn: 20,
          },
        });
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]).toEqual({
        messageId: 'msg-1',
        message: 'Consider using a guard clause here.',
        type: 'hint',
        source: 'coaching',
        anchor: {
          path: '/src/index.ts',
          startLine: 10,
          startColumn: 1,
          endLine: 10,
          endColumn: 20,
        },
      });
    });

    it('should not call showCoachingToast for anchored messages', () => {
      const { result } = renderHook(() => useCoachingMessages());

      act(() => {
        simulateMessage('coaching:message', {
          messageId: 'msg-anchored',
          message: 'Anchored hint',
          type: 'hint',
          source: 'coaching',
          anchor: {
            path: '/src/index.ts',
            startLine: 5,
            startColumn: 1,
            endLine: 5,
            endColumn: 10,
          },
        });
      });

      expect(result.current.messages).toHaveLength(1);
      expect(mockShowToast).not.toHaveBeenCalled();
    });

    it('should call showCoachingToast for unanchored messages', () => {
      renderHook(() => useCoachingMessages());

      act(() => {
        simulateMessage('coaching:message', {
          messageId: 'msg-toast',
          message: 'Nice work on that function!',
          type: 'success',
          source: 'coaching',
        });
      });

      expect(mockShowToast).toHaveBeenCalledTimes(1);
      expect(mockShowToast).toHaveBeenCalledWith({
        messageId: 'msg-toast',
        message: 'Nice work on that function!',
        type: 'success',
      });
    });

    it('should store unanchored messages in the messages array as well', () => {
      const { result } = renderHook(() => useCoachingMessages());

      act(() => {
        simulateMessage('coaching:message', {
          messageId: 'msg-unanchored',
          message: 'General guidance',
          type: 'info',
          source: 'observer',
        });
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].messageId).toBe('msg-unanchored');
    });

    it('should deduplicate messages by messageId', () => {
      const { result } = renderHook(() => useCoachingMessages());

      act(() => {
        simulateMessage('coaching:message', {
          messageId: 'msg-dup',
          message: 'First arrival',
          type: 'hint',
          source: 'coaching',
          anchor: {
            path: '/src/index.ts',
            startLine: 1,
            startColumn: 1,
            endLine: 1,
            endColumn: 5,
          },
        });
      });

      act(() => {
        simulateMessage('coaching:message', {
          messageId: 'msg-dup',
          message: 'Second arrival (same id)',
          type: 'hint',
          source: 'coaching',
          anchor: {
            path: '/src/index.ts',
            startLine: 1,
            startColumn: 1,
            endLine: 1,
            endColumn: 5,
          },
        });
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].message).toBe('First arrival');
    });
  });

  // -------------------------------------------------------------------------
  // dismissMessage
  // -------------------------------------------------------------------------

  describe('dismissMessage', () => {
    it('should remove the specified message', () => {
      const { result } = renderHook(() => useCoachingMessages());

      // Add two messages
      act(() => {
        simulateMessage('coaching:message', {
          messageId: 'msg-a',
          message: 'First',
          type: 'hint',
          source: 'coaching',
        });
      });

      act(() => {
        simulateMessage('coaching:message', {
          messageId: 'msg-b',
          message: 'Second',
          type: 'info',
          source: 'explain',
        });
      });

      expect(result.current.messages).toHaveLength(2);

      act(() => {
        result.current.dismissMessage('msg-a');
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].messageId).toBe('msg-b');
    });

    it('should call dismissCoachingToast with the messageId', () => {
      const { result } = renderHook(() => useCoachingMessages());

      act(() => {
        simulateMessage('coaching:message', {
          messageId: 'msg-dismiss',
          message: 'To be dismissed',
          type: 'warning',
          source: 'coaching',
        });
      });

      mockDismissToast.mockClear();

      act(() => {
        result.current.dismissMessage('msg-dismiss');
      });

      expect(mockDismissToast).toHaveBeenCalledTimes(1);
      expect(mockDismissToast).toHaveBeenCalledWith('msg-dismiss');
    });
  });

  // -------------------------------------------------------------------------
  // dismissAllCoaching
  // -------------------------------------------------------------------------

  describe('dismissAllCoaching', () => {
    it('should clear all messages', () => {
      const { result } = renderHook(() => useCoachingMessages());

      act(() => {
        simulateMessage('coaching:message', {
          messageId: 'msg-1',
          message: 'First',
          type: 'hint',
          source: 'coaching',
        });
        simulateMessage('coaching:message', {
          messageId: 'msg-2',
          message: 'Second',
          type: 'info',
          source: 'explain',
        });
      });

      expect(result.current.messages).toHaveLength(2);

      act(() => {
        result.current.dismissAllCoaching();
      });

      expect(result.current.messages).toHaveLength(0);
    });

    it('should call dismissAllCoachingToasts', () => {
      const { result } = renderHook(() => useCoachingMessages());

      act(() => {
        result.current.dismissAllCoaching();
      });

      expect(mockDismissAll).toHaveBeenCalledTimes(1);
    });

    it('should clear expandedIds', () => {
      const { result } = renderHook(() => useCoachingMessages());

      act(() => {
        result.current.expandMessage('msg-expanded');
      });

      expect(result.current.expandedIds.has('msg-expanded')).toBe(true);

      act(() => {
        result.current.dismissAllCoaching();
      });

      expect(result.current.expandedIds.size).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // expandMessage
  // -------------------------------------------------------------------------

  describe('expandMessage', () => {
    it('should add messageId to expandedIds', () => {
      const { result } = renderHook(() => useCoachingMessages());

      expect(result.current.expandedIds.has('msg-x')).toBe(false);

      act(() => {
        result.current.expandMessage('msg-x');
      });

      expect(result.current.expandedIds.has('msg-x')).toBe(true);
    });

    it('should not duplicate if expanded again', () => {
      const { result } = renderHook(() => useCoachingMessages());

      act(() => {
        result.current.expandMessage('msg-y');
      });

      act(() => {
        result.current.expandMessage('msg-y');
      });

      // Still only one entry
      expect(result.current.expandedIds.size).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // coaching:clear
  // -------------------------------------------------------------------------

  describe('coaching:clear', () => {
    it('should remove specific messages when messageIds are provided', () => {
      const { result } = renderHook(() => useCoachingMessages());

      act(() => {
        simulateMessage('coaching:message', {
          messageId: 'msg-1',
          message: 'First',
          type: 'hint',
          source: 'coaching',
        });
        simulateMessage('coaching:message', {
          messageId: 'msg-2',
          message: 'Second',
          type: 'info',
          source: 'coaching',
        });
        simulateMessage('coaching:message', {
          messageId: 'msg-3',
          message: 'Third',
          type: 'success',
          source: 'coaching',
        });
      });

      expect(result.current.messages).toHaveLength(3);

      mockDismissToast.mockClear();

      act(() => {
        simulateMessage('coaching:clear', {
          messageIds: ['msg-1', 'msg-3'],
        });
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].messageId).toBe('msg-2');
      expect(mockDismissToast).toHaveBeenCalledTimes(2);
      expect(mockDismissToast).toHaveBeenCalledWith('msg-1');
      expect(mockDismissToast).toHaveBeenCalledWith('msg-3');
    });

    it('should clear all messages when no messageIds provided', () => {
      const { result } = renderHook(() => useCoachingMessages());

      act(() => {
        simulateMessage('coaching:message', {
          messageId: 'msg-a',
          message: 'Alpha',
          type: 'hint',
          source: 'coaching',
        });
        simulateMessage('coaching:message', {
          messageId: 'msg-b',
          message: 'Beta',
          type: 'info',
          source: 'coaching',
        });
      });

      expect(result.current.messages).toHaveLength(2);

      act(() => {
        simulateMessage('coaching:clear', {});
      });

      expect(result.current.messages).toHaveLength(0);
      expect(mockDismissAll).toHaveBeenCalled();
    });

    it('should clear all messages when messageIds is an empty array', () => {
      const { result } = renderHook(() => useCoachingMessages());

      act(() => {
        simulateMessage('coaching:message', {
          messageId: 'msg-c',
          message: 'Gamma',
          type: 'warning',
          source: 'observer',
        });
      });

      act(() => {
        simulateMessage('coaching:clear', { messageIds: [] });
      });

      expect(result.current.messages).toHaveLength(0);
      expect(mockDismissAll).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  it('should unsubscribe from WebSocket on unmount', () => {
    const { unmount } = renderHook(() => useCoachingMessages());

    expect(handlers.has('coaching:message')).toBe(true);
    expect(handlers.has('coaching:clear')).toBe(true);

    unmount();

    expect(handlers.has('coaching:message')).toBe(false);
    expect(handlers.has('coaching:clear')).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Stable references
  // -------------------------------------------------------------------------

  it('should provide stable callback references across re-renders', () => {
    const { result, rerender } = renderHook(() => useCoachingMessages());
    const firstDismiss = result.current.dismissMessage;
    const firstDismissAll = result.current.dismissAllCoaching;
    const firstExpand = result.current.expandMessage;

    rerender();

    expect(result.current.dismissMessage).toBe(firstDismiss);
    expect(result.current.dismissAllCoaching).toBe(firstDismissAll);
    expect(result.current.expandMessage).toBe(firstExpand);
  });
});
