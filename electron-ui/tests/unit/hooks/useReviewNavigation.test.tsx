/**
 * Unit tests for the useReviewNavigation hook.
 *
 * Tests cover:
 * - Subscribes to reviewNavigation service state
 * - Handles coaching:review_result message and starts review
 * - next/previous/exitReview call the service methods
 * - Returns correct focusedMessageId from the service
 * - Cleanup unsubscribes on unmount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { WebSocketMessage } from '@shared/types/websocket-messages';
import { reviewNavigation } from '../../../renderer/src/services/review-navigation';
import { useReviewNavigation } from '../../../renderer/src/hooks/useReviewNavigation';

// ---------------------------------------------------------------------------
// Mock useWebSocket (multi-handler support, matching useCoachingMessages test)
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
  // Reset the singleton to clean state
  reviewNavigation.exitReview();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// Tests
// ===========================================================================

describe('useReviewNavigation', () => {
  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  it('should initialize with inactive review state', () => {
    const { result } = renderHook(() => useReviewNavigation());

    expect(result.current.reviewState.active).toBe(false);
    expect(result.current.reviewState.scope).toBe('');
    expect(result.current.reviewState.currentIndex).toBe(0);
    expect(result.current.reviewState.total).toBe(0);
    expect(result.current.focusedMessageId).toBeUndefined();
    expect(result.current.reviewComments).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // coaching:review_result handling
  // -------------------------------------------------------------------------

  describe('coaching:review_result', () => {
    it('should start a review when receiving coaching:review_result', () => {
      const { result } = renderHook(() => useReviewNavigation());

      act(() => {
        simulateMessage('coaching:review_result', {
          scope: 'file',
          comments: [
            {
              messageId: 'rev-1',
              path: '/src/App.tsx',
              range: { startLine: 10, startColumn: 1, endLine: 12, endColumn: 1 },
              message: 'Consider extracting this',
              type: 'hint',
            },
            {
              messageId: 'rev-2',
              path: '/src/App.tsx',
              range: { startLine: 20, startColumn: 1, endLine: 22, endColumn: 1 },
              message: 'Add error handling here',
              type: 'warning',
            },
          ],
        });
      });

      expect(result.current.reviewState.active).toBe(true);
      expect(result.current.reviewState.scope).toBe('file');
      expect(result.current.reviewState.total).toBe(2);
      expect(result.current.reviewState.currentIndex).toBe(0);
      expect(result.current.reviewComments).toHaveLength(2);
    });

    it('should set focusedMessageId to the first comment after starting review', () => {
      const { result } = renderHook(() => useReviewNavigation());

      act(() => {
        simulateMessage('coaching:review_result', {
          scope: 'current',
          comments: [
            {
              messageId: 'rev-focus-1',
              path: '/src/index.ts',
              range: { startLine: 5, startColumn: 1, endLine: 5, endColumn: 10 },
              message: 'First comment',
              type: 'hint',
            },
          ],
        });
      });

      expect(result.current.focusedMessageId).toBe('rev-focus-1');
    });
  });

  // -------------------------------------------------------------------------
  // Navigation methods
  // -------------------------------------------------------------------------

  describe('next', () => {
    it('should advance to the next comment', () => {
      const { result } = renderHook(() => useReviewNavigation());

      act(() => {
        simulateMessage('coaching:review_result', {
          scope: 'file',
          comments: [
            {
              messageId: 'nav-1',
              path: '/src/a.ts',
              range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 10 },
              message: 'Comment 1',
              type: 'hint',
            },
            {
              messageId: 'nav-2',
              path: '/src/a.ts',
              range: { startLine: 10, startColumn: 1, endLine: 10, endColumn: 10 },
              message: 'Comment 2',
              type: 'info',
            },
          ],
        });
      });

      expect(result.current.reviewState.currentIndex).toBe(0);

      act(() => {
        result.current.next();
      });

      expect(result.current.reviewState.currentIndex).toBe(1);
      expect(result.current.focusedMessageId).toBe('nav-2');
    });
  });

  describe('previous', () => {
    it('should go to the previous comment with wrap-around', () => {
      const { result } = renderHook(() => useReviewNavigation());

      act(() => {
        simulateMessage('coaching:review_result', {
          scope: 'file',
          comments: [
            {
              messageId: 'prev-1',
              path: '/src/a.ts',
              range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 10 },
              message: 'Comment 1',
              type: 'hint',
            },
            {
              messageId: 'prev-2',
              path: '/src/a.ts',
              range: { startLine: 10, startColumn: 1, endLine: 10, endColumn: 10 },
              message: 'Comment 2',
              type: 'info',
            },
          ],
        });
      });

      expect(result.current.reviewState.currentIndex).toBe(0);

      act(() => {
        result.current.previous();
      });

      // Wraps to last comment
      expect(result.current.reviewState.currentIndex).toBe(1);
      expect(result.current.focusedMessageId).toBe('prev-2');
    });
  });

  describe('exitReview', () => {
    it('should exit review and reset state', () => {
      const { result } = renderHook(() => useReviewNavigation());

      act(() => {
        simulateMessage('coaching:review_result', {
          scope: 'file',
          comments: [
            {
              messageId: 'exit-1',
              path: '/src/a.ts',
              range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 10 },
              message: 'Comment',
              type: 'hint',
            },
          ],
        });
      });

      expect(result.current.reviewState.active).toBe(true);

      act(() => {
        result.current.exitReview();
      });

      expect(result.current.reviewState.active).toBe(false);
      expect(result.current.reviewState.total).toBe(0);
      expect(result.current.reviewComments).toEqual([]);
      expect(result.current.focusedMessageId).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Stable callback references
  // -------------------------------------------------------------------------

  it('should provide stable callback references across re-renders', () => {
    const { result, rerender } = renderHook(() => useReviewNavigation());

    const firstNext = result.current.next;
    const firstPrevious = result.current.previous;
    const firstExit = result.current.exitReview;

    rerender();

    expect(result.current.next).toBe(firstNext);
    expect(result.current.previous).toBe(firstPrevious);
    expect(result.current.exitReview).toBe(firstExit);
  });

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  it('should unsubscribe from WebSocket on unmount', () => {
    const { unmount } = renderHook(() => useReviewNavigation());

    expect(handlers.has('coaching:review_result')).toBe(true);

    unmount();

    expect(handlers.has('coaching:review_result')).toBe(false);
  });
});
