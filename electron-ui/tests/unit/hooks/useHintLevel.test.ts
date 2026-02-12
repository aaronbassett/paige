/**
 * Unit tests for the useHintLevel hook.
 *
 * Tests cover:
 * - Default initialization at level 0
 * - Setting level from session:start message
 * - Restoring level from session:restore message
 * - setHintLevel updates level immediately
 * - cycleHintLevel cycles 0 -> 1 -> 2 -> 3 -> 0
 * - increaseHintLevel clamps at 3
 * - decreaseHintLevel clamps at 0
 * - Debounced WebSocket message on level change (200ms)
 * - Cleanup of debounce timer on unmount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { WebSocketMessage } from '@shared/types/websocket-messages';
import { useHintLevel } from '../../../renderer/src/hooks/useHintLevel';

// ---------------------------------------------------------------------------
// Mock useWebSocket
// ---------------------------------------------------------------------------

type MessageHandler = (msg: WebSocketMessage) => void;

const mockSend = vi.fn<(type: string, payload: unknown) => Promise<WebSocketMessage | void>>();
const handlers = new Map<string, MessageHandler>();

vi.mock('../../../renderer/src/hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    status: 'active' as const,
    reconnectAttempt: 0,
    send: mockSend,
    on: (type: string, handler: MessageHandler) => {
      handlers.set(type, handler);
      return () => {
        handlers.delete(type);
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
  const handler = handlers.get(type);
  if (handler) {
    handler(makeMessage(type, payload));
  }
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
  handlers.clear();
  mockSend.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ===========================================================================
// Tests
// ===========================================================================

describe('useHintLevel', () => {
  it('should initialize at level 0 by default', () => {
    const { result } = renderHook(() => useHintLevel());
    expect(result.current.hintLevel).toBe(0);
  });

  it('should set level from session:start message', () => {
    const { result } = renderHook(() => useHintLevel());

    act(() => {
      simulateMessage('session:start', {
        sessionId: 'sess-1',
        issueContext: { number: 1, title: 'Test', url: 'http://example.com' },
        phases: [],
        initialHintLevel: 2,
      });
    });

    expect(result.current.hintLevel).toBe(2);
  });

  it('should restore level from session:restore message', () => {
    const { result } = renderHook(() => useHintLevel());

    act(() => {
      simulateMessage('session:restore', {
        sessionId: 'sess-2',
        issueContext: { number: 1, title: 'Test', url: 'http://example.com' },
        phases: [],
        openTabs: [],
        activeTabPath: '',
        hintLevel: 3,
      });
    });

    expect(result.current.hintLevel).toBe(3);
  });

  it('should update level immediately when setHintLevel is called', () => {
    const { result } = renderHook(() => useHintLevel());

    act(() => {
      result.current.setHintLevel(2);
    });

    expect(result.current.hintLevel).toBe(2);
  });

  it('should send debounced hints:level_change message after 200ms', () => {
    const { result } = renderHook(() => useHintLevel());

    act(() => {
      result.current.setHintLevel(1);
    });

    // Should NOT have sent yet (debounce not elapsed)
    expect(mockSend).not.toHaveBeenCalled();

    // Advance timers past the 200ms debounce
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith('hints:level_change', { level: 1 });
  });

  it('should debounce rapid level changes and only send the last value', () => {
    const { result } = renderHook(() => useHintLevel());

    act(() => {
      result.current.setHintLevel(1);
    });

    // Change again before debounce fires
    act(() => {
      vi.advanceTimersByTime(100);
      result.current.setHintLevel(3);
    });

    // Advance past the second debounce
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Only one send should have occurred, with the final value
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith('hints:level_change', { level: 3 });
  });

  // -------------------------------------------------------------------------
  // cycleHintLevel
  // -------------------------------------------------------------------------

  describe('cycleHintLevel', () => {
    it('should cycle 0 -> 1 -> 2 -> 3 -> 0', () => {
      const { result } = renderHook(() => useHintLevel());
      expect(result.current.hintLevel).toBe(0);

      act(() => {
        result.current.cycleHintLevel();
      });
      expect(result.current.hintLevel).toBe(1);

      act(() => {
        result.current.cycleHintLevel();
      });
      expect(result.current.hintLevel).toBe(2);

      act(() => {
        result.current.cycleHintLevel();
      });
      expect(result.current.hintLevel).toBe(3);

      act(() => {
        result.current.cycleHintLevel();
      });
      expect(result.current.hintLevel).toBe(0);
    });

    it('should send debounced WebSocket message on cycle', () => {
      const { result } = renderHook(() => useHintLevel());

      act(() => {
        result.current.cycleHintLevel();
      });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(mockSend).toHaveBeenCalledWith('hints:level_change', { level: 1 });
    });
  });

  // -------------------------------------------------------------------------
  // increaseHintLevel
  // -------------------------------------------------------------------------

  describe('increaseHintLevel', () => {
    it('should increase level by 1', () => {
      const { result } = renderHook(() => useHintLevel());

      act(() => {
        result.current.increaseHintLevel();
      });
      expect(result.current.hintLevel).toBe(1);

      act(() => {
        result.current.increaseHintLevel();
      });
      expect(result.current.hintLevel).toBe(2);
    });

    it('should clamp at level 3', () => {
      const { result } = renderHook(() => useHintLevel());

      // Set to max
      act(() => {
        result.current.setHintLevel(3);
      });
      expect(result.current.hintLevel).toBe(3);

      // Try to go higher
      act(() => {
        result.current.increaseHintLevel();
      });
      expect(result.current.hintLevel).toBe(3);
    });

    it('should not send WebSocket message when already at max', () => {
      const { result } = renderHook(() => useHintLevel());

      act(() => {
        result.current.setHintLevel(3);
      });

      // Clear the debounced send from setHintLevel
      act(() => {
        vi.advanceTimersByTime(200);
      });
      mockSend.mockClear();

      // Try to increase past max
      act(() => {
        result.current.increaseHintLevel();
      });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // decreaseHintLevel
  // -------------------------------------------------------------------------

  describe('decreaseHintLevel', () => {
    it('should decrease level by 1', () => {
      const { result } = renderHook(() => useHintLevel());

      act(() => {
        result.current.setHintLevel(3);
      });

      act(() => {
        result.current.decreaseHintLevel();
      });
      expect(result.current.hintLevel).toBe(2);
    });

    it('should clamp at level 0', () => {
      const { result } = renderHook(() => useHintLevel());
      expect(result.current.hintLevel).toBe(0);

      act(() => {
        result.current.decreaseHintLevel();
      });
      expect(result.current.hintLevel).toBe(0);
    });

    it('should not send WebSocket message when already at min', () => {
      const { result } = renderHook(() => useHintLevel());
      expect(result.current.hintLevel).toBe(0);

      act(() => {
        result.current.decreaseHintLevel();
      });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  it('should unsubscribe from WebSocket on unmount', () => {
    const { unmount } = renderHook(() => useHintLevel());

    expect(handlers.has('session:start')).toBe(true);
    expect(handlers.has('session:restore')).toBe(true);

    unmount();

    expect(handlers.has('session:start')).toBe(false);
    expect(handlers.has('session:restore')).toBe(false);
  });

  it('should clean up debounce timer on unmount', () => {
    const { result, unmount } = renderHook(() => useHintLevel());

    // Start a debounced send
    act(() => {
      result.current.setHintLevel(2);
    });

    // Unmount before debounce fires
    unmount();

    // Advance past debounce time
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // The debounced send should not have fired
    expect(mockSend).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Stable references
  // -------------------------------------------------------------------------

  it('should provide stable callback references across re-renders', () => {
    const { result, rerender } = renderHook(() => useHintLevel());
    const firstSetHintLevel = result.current.setHintLevel;
    const firstCycleHintLevel = result.current.cycleHintLevel;
    const firstIncreaseHintLevel = result.current.increaseHintLevel;
    const firstDecreaseHintLevel = result.current.decreaseHintLevel;

    rerender();

    expect(result.current.setHintLevel).toBe(firstSetHintLevel);
    expect(result.current.cycleHintLevel).toBe(firstCycleHintLevel);
    expect(result.current.increaseHintLevel).toBe(firstIncreaseHintLevel);
    expect(result.current.decreaseHintLevel).toBe(firstDecreaseHintLevel);
  });
});
