/**
 * Unit tests for the usePlanningProgress hook.
 *
 * Tests cover:
 * - Initial idle state
 * - Transition to loading on planning:started
 * - Log accumulation from planning:progress
 * - Phase updates from planning:phase_update
 * - Completion on planning:complete
 * - Error handling on planning:error
 * - Log entry cap (MAX_LOG_ENTRIES = 50)
 * - Unsubscribe on unmount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { WebSocketMessage, PlanningCompletePayload } from '@shared/types/websocket-messages';
import { usePlanningProgress } from '../../../renderer/src/hooks/usePlanningProgress';

// ---------------------------------------------------------------------------
// Mock useWebSocket (vi.mock calls are hoisted by Vitest)
// ---------------------------------------------------------------------------

type MessageHandler = (msg: WebSocketMessage) => void;

const handlers = new Map<string, MessageHandler>();

vi.mock('../../../renderer/src/hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    send: vi.fn(),
    on: (type: string, handler: MessageHandler) => {
      handlers.set(type, handler);
      return () => {
        handlers.delete(type);
      };
    },
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMessage(type: string, payload: unknown): WebSocketMessage {
  return {
    type,
    payload,
    timestamp: Date.now(),
  } as unknown as WebSocketMessage;
}

/** Simulate a WebSocket message arriving for a given type. */
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
  handlers.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// Hook tests
// ===========================================================================

describe('usePlanningProgress', () => {
  it('should start with idle state and empty logs', () => {
    const { result } = renderHook(() => usePlanningProgress());

    expect(result.current.status).toBe('idle');
    expect(result.current.logs).toEqual([]);
    expect(result.current.currentPhase).toBeNull();
    expect(result.current.issueTitle).toBeNull();
    expect(result.current.progress).toBe(0);
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should transition to loading on planning:started', () => {
    const { result } = renderHook(() => usePlanningProgress());

    act(() => {
      simulateMessage('planning:started', {
        sessionId: 's1',
        issueTitle: 'Fix login bug',
      });
    });

    expect(result.current.status).toBe('loading');
    expect(result.current.issueTitle).toBe('Fix login bug');
  });

  it('should accumulate log entries from planning:progress', () => {
    const { result } = renderHook(() => usePlanningProgress());

    act(() => {
      simulateMessage('planning:progress', { message: 'Reading file...' });
    });

    act(() => {
      simulateMessage('planning:progress', { message: 'Searching codebase...' });
    });

    expect(result.current.logs).toHaveLength(2);
    expect(result.current.logs[0]?.message).toBe('Reading file...');
    expect(result.current.logs[1]?.message).toBe('Searching codebase...');
  });

  it('should capture toolName and filePath in log entries', () => {
    const { result } = renderHook(() => usePlanningProgress());

    act(() => {
      simulateMessage('planning:progress', {
        message: 'Reading src/index.ts',
        toolName: 'read_file',
        filePath: 'src/index.ts',
      });
    });

    expect(result.current.logs).toHaveLength(1);
    expect(result.current.logs[0]?.toolName).toBe('read_file');
    expect(result.current.logs[0]?.filePath).toBe('src/index.ts');
  });

  it('should update currentPhase and progress on planning:phase_update', () => {
    const { result } = renderHook(() => usePlanningProgress());

    act(() => {
      simulateMessage('planning:phase_update', {
        phase: 'exploring',
        progress: 35,
      });
    });

    expect(result.current.currentPhase).toBe('exploring');
    expect(result.current.progress).toBe(35);
  });

  it('should transition to complete on planning:complete', () => {
    const { result } = renderHook(() => usePlanningProgress());

    const completePayload: PlanningCompletePayload = {
      sessionId: 's1',
      plan: {
        title: 'Fix login bug',
        summary: 'Fix the authentication flow',
        phases: [],
      },
      fileTree: [],
      fileHints: [],
      issueContext: {
        title: 'Fix login bug',
        number: 42,
        body: 'The login page crashes',
        labels: ['bug'],
        url: 'https://github.com/test/test/issues/42',
      },
    };

    act(() => {
      simulateMessage('planning:complete', completePayload);
    });

    expect(result.current.status).toBe('complete');
    expect(result.current.result).toEqual(completePayload);
    expect(result.current.progress).toBe(100);
  });

  it('should transition to error on planning:error', () => {
    const { result } = renderHook(() => usePlanningProgress());

    act(() => {
      simulateMessage('planning:error', {
        sessionId: 's1',
        error: 'API rate limit exceeded',
      });
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('API rate limit exceeded');
  });

  it('should cap log entries at 50', () => {
    const { result } = renderHook(() => usePlanningProgress());

    act(() => {
      for (let i = 0; i < 60; i++) {
        simulateMessage('planning:progress', { message: `Log entry ${i}` });
      }
    });

    expect(result.current.logs).toHaveLength(50);
    // The first 10 entries (0-9) should have been evicted
    expect(result.current.logs[0]?.message).toBe('Log entry 10');
    expect(result.current.logs[49]?.message).toBe('Log entry 59');
  });

  it('should unsubscribe from all WebSocket events on unmount', () => {
    const { unmount } = renderHook(() => usePlanningProgress());

    expect(handlers.has('planning:started')).toBe(true);
    expect(handlers.has('planning:progress')).toBe(true);
    expect(handlers.has('planning:phase_update')).toBe(true);
    expect(handlers.has('planning:complete')).toBe(true);
    expect(handlers.has('planning:error')).toBe(true);

    unmount();

    expect(handlers.has('planning:started')).toBe(false);
    expect(handlers.has('planning:progress')).toBe(false);
    expect(handlers.has('planning:phase_update')).toBe(false);
    expect(handlers.has('planning:complete')).toBe(false);
    expect(handlers.has('planning:error')).toBe(false);
  });

  it('should handle full lifecycle: started -> progress -> phase -> complete', () => {
    const { result } = renderHook(() => usePlanningProgress());

    // Started
    act(() => {
      simulateMessage('planning:started', {
        sessionId: 's1',
        issueTitle: 'Add dark mode',
      });
    });
    expect(result.current.status).toBe('loading');

    // Progress
    act(() => {
      simulateMessage('planning:progress', { message: 'Fetching issue...' });
      simulateMessage('planning:phase_update', { phase: 'fetching', progress: 10 });
    });
    expect(result.current.logs).toHaveLength(1);
    expect(result.current.currentPhase).toBe('fetching');

    // More progress
    act(() => {
      simulateMessage('planning:progress', { message: 'Reading files...' });
      simulateMessage('planning:phase_update', { phase: 'exploring', progress: 50 });
    });
    expect(result.current.logs).toHaveLength(2);
    expect(result.current.currentPhase).toBe('exploring');
    expect(result.current.progress).toBe(50);

    // Complete
    const completePayload: PlanningCompletePayload = {
      sessionId: 's1',
      plan: { title: 'Add dark mode', summary: 'Implement dark theme', phases: [] },
      fileTree: [],
      fileHints: [],
      issueContext: {
        title: 'Add dark mode',
        number: 7,
        body: 'We need dark mode',
        labels: ['enhancement'],
        url: 'https://github.com/test/test/issues/7',
      },
    };

    act(() => {
      simulateMessage('planning:complete', completePayload);
    });

    expect(result.current.status).toBe('complete');
    expect(result.current.progress).toBe(100);
    expect(result.current.result).toEqual(completePayload);
  });
});
