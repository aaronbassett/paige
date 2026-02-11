/**
 * Integration tests for the Hinting System workflow.
 *
 * Verifies the complete hinting system workflow:
 *   1. Coaching messages render as balloons or collapsed icons based on hint level
 *   2. Level changes instantly update rendering (icons <-> balloons)
 *   3. Explain source always renders as full balloon regardless of level
 *   4. Unanchored messages fire toasts
 *   5. Review flow with navigation works end-to-end
 *   6. Phase transitions clear coaching but not review comments
 *
 * Mocks:
 *   - framer-motion: motion.div as plain div, AnimatePresence as pass-through
 *   - @floating-ui/react: useFloating returns fixed styles, FloatingArrow as div
 *   - react-toastify: toast() and ToastContainer captured for assertion
 *   - useWebSocket: captures `on` handlers so tests can simulate server messages
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import { useState } from 'react';
import type { WebSocketMessage } from '@shared/types/websocket-messages';

// ---------------------------------------------------------------------------
// Hoisted mock variables (referenced inside vi.mock factories)
// ---------------------------------------------------------------------------

const { mockToast, mockToastDismiss, mockSend, mockOn } = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockToastDismiss: vi.fn(),
  mockSend: vi.fn(),
  mockOn: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock framer-motion
// ---------------------------------------------------------------------------

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      animate: _a,
      initial: _i,
      exit: _e,
      layout: _l,
      transition: _t,
      layoutId: _lid,
      ...rest
    }: React.HTMLAttributes<HTMLDivElement> & {
      animate?: unknown;
      initial?: unknown;
      exit?: unknown;
      layout?: unknown;
      transition?: unknown;
      layoutId?: unknown;
    }) => <div {...rest}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// ---------------------------------------------------------------------------
// Mock @floating-ui/react
// ---------------------------------------------------------------------------

vi.mock('@floating-ui/react', () => ({
  useFloating: () => ({
    refs: { setReference: vi.fn(), setFloating: vi.fn() },
    floatingStyles: { position: 'absolute' as const, top: 0, left: 0 },
    context: {
      refs: { setReference: vi.fn(), setFloating: vi.fn() },
      elements: {},
    },
  }),
  offset: () => ({}),
  flip: () => ({}),
  shift: () => ({}),
  arrow: () => ({}),
  autoUpdate: vi.fn(() => vi.fn()),
  FloatingArrow: (props: Record<string, unknown>) => (
    <div data-testid="floating-arrow" {...props} />
  ),
}));

// ---------------------------------------------------------------------------
// Mock react-toastify
// ---------------------------------------------------------------------------

vi.mock('react-toastify', () => ({
  toast: Object.assign(mockToast, { dismiss: mockToastDismiss }),
  ToastContainer: () => <div data-testid="toast-container" />,
}));

// ---------------------------------------------------------------------------
// Mock useWebSocket
// ---------------------------------------------------------------------------

vi.mock('../../renderer/src/hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    status: 'connected' as const,
    reconnectAttempt: 0,
    send: mockSend,
    on: mockOn,
  }),
}));

// ---------------------------------------------------------------------------
// Import components and hooks after mocks are set up
// ---------------------------------------------------------------------------

import { useCoachingMessages } from '../../renderer/src/hooks/useCoachingMessages';
import { useHintLevel } from '../../renderer/src/hooks/useHintLevel';
import { useReviewNavigation } from '../../renderer/src/hooks/useReviewNavigation';
import {
  CoachingOverlay,
  type MonacoEditorLike,
} from '../../renderer/src/components/Hints/CoachingOverlay';
import { CoachingToastContainer } from '../../renderer/src/components/Hints/EditorToast';
import { reviewNavigation } from '../../renderer/src/services/review-navigation';

// ---------------------------------------------------------------------------
// Handler capture helper
// ---------------------------------------------------------------------------

/**
 * Captures the WebSocket message handlers registered by the test wrapper
 * and its child hooks (useCoachingMessages, useHintLevel, useReviewNavigation).
 *
 * Supports multiple handlers per message type since multiple hooks may
 * register separate handlers for the same message.
 *
 * After rendering, call `simulateMessage` to push data into the component
 * as if it arrived from the backend.
 */
function setupHandlerCapture(): {
  handlers: Map<string, Array<(msg: WebSocketMessage) => void>>;
  simulateMessage: (type: string, payload: unknown) => void;
} {
  const handlers = new Map<string, Array<(msg: WebSocketMessage) => void>>();

  mockOn.mockImplementation(
    (type: string, handler: (msg: WebSocketMessage) => void) => {
      const existing = handlers.get(type) ?? [];
      existing.push(handler);
      handlers.set(type, existing);
      return vi.fn(); // unsubscribe
    },
  );

  const simulateMessage = (type: string, payload: unknown) => {
    const typeHandlers = handlers.get(type);
    if (typeHandlers) {
      act(() => {
        const msg = {
          type,
          payload,
          timestamp: Date.now(),
        } as WebSocketMessage;
        for (const handler of typeHandlers) {
          handler(msg);
        }
      });
    }
  };

  return { handlers, simulateMessage };
}

// ---------------------------------------------------------------------------
// Mock Monaco editor
// ---------------------------------------------------------------------------

/**
 * Creates a mock MonacoEditorLike that returns fixed positions based on
 * lineNumber so anchored messages at different lines render at different
 * vertical offsets.
 */
function createMockEditor(): MonacoEditorLike {
  return {
    getScrolledVisiblePosition: vi.fn(
      ({ lineNumber }: { lineNumber: number; column: number }) => ({
        top: lineNumber * 20,
        left: 100,
        height: 20,
      }),
    ),
    onDidScrollChange: vi.fn(() => ({ dispose: vi.fn() })),
  };
}

// ---------------------------------------------------------------------------
// Test wrapper component
// ---------------------------------------------------------------------------

/**
 * Composes useCoachingMessages, useHintLevel, and useReviewNavigation into
 * a single test surface. Renders CoachingOverlay + CoachingToastContainer
 * so integration tests can verify the full hinting pipeline.
 */
function TestHintingWrapper() {
  const { hintLevel, setHintLevel } = useHintLevel();
  const { messages, dismissMessage, expandedIds, expandMessage, dismissAllCoaching } =
    useCoachingMessages();
  const { reviewState, focusedMessageId, next, previous, exitReview } =
    useReviewNavigation();

  // Stable mock editor instance across re-renders
  const [mockEditor] = useState(() => createMockEditor());

  return (
    <div>
      <div data-testid="hint-level">{hintLevel}</div>
      <div data-testid="message-count">{messages.length}</div>
      <div data-testid="review-active">{String(reviewState.active)}</div>
      <div data-testid="review-count">{reviewState.total}</div>
      <div data-testid="review-index">{reviewState.currentIndex}</div>

      <button data-testid="set-level-0" onClick={() => setHintLevel(0)}>
        Level 0
      </button>
      <button data-testid="set-level-2" onClick={() => setHintLevel(2)}>
        Level 2
      </button>
      <button data-testid="set-level-3" onClick={() => setHintLevel(3)}>
        Level 3
      </button>
      <button data-testid="dismiss-all" onClick={dismissAllCoaching}>
        Dismiss All
      </button>
      <button data-testid="review-next" onClick={next}>
        Next
      </button>
      <button data-testid="review-prev" onClick={previous}>
        Prev
      </button>
      <button data-testid="review-exit" onClick={exitReview}>
        Exit Review
      </button>

      <div style={{ position: 'relative', width: 800, height: 600 }}>
        <CoachingOverlay
          messages={messages}
          hintLevel={hintLevel}
          expandedIds={expandedIds}
          activeFilePath="/test/file.ts"
          editor={mockEditor}
          onDismiss={dismissMessage}
          onExpand={expandMessage}
          focusedMessageId={focusedMessageId}
        />
      </div>

      <CoachingToastContainer />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Hinting System Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToast.mockClear();
    mockToastDismiss.mockClear();
    reviewNavigation.exitReview(); // Reset review state
  });

  // -------------------------------------------------------------------------
  // 1. Anchored coaching at level 0 -> collapsed icon
  // -------------------------------------------------------------------------

  it('renders anchored coaching message as collapsed icon at level 0', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<TestHintingWrapper />);

    // Start a session (sets hint level to 0)
    simulateMessage('session:start', {
      sessionId: 'test',
      issueContext: {
        number: 1,
        title: 'Test',
        url: 'https://github.com/test',
      },
      phases: [{ number: 1, title: 'Phase 1', status: 'active' }],
      initialHintLevel: 0,
    });

    // Send coaching message with anchor
    simulateMessage('coaching:message', {
      messageId: 'msg-1',
      message: 'Try this approach',
      type: 'hint',
      anchor: {
        path: '/test/file.ts',
        startLine: 5,
        startColumn: 1,
        endLine: 5,
        endColumn: 20,
      },
      source: 'coaching',
    });

    expect(screen.getByTestId('message-count').textContent).toBe('1');
    // At level 0 + source coaching -> collapsed icon (button with "Expand hint message")
    expect(
      screen.getByRole('button', { name: /expand hint message/i }),
    ).toBeTruthy();
    // No full balloon visible
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 2. Anchored coaching at level 2 -> full balloon
  // -------------------------------------------------------------------------

  it('renders anchored coaching message as full balloon at level 2', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<TestHintingWrapper />);

    simulateMessage('session:start', {
      sessionId: 'test',
      issueContext: {
        number: 1,
        title: 'Test',
        url: 'https://github.com/test',
      },
      phases: [{ number: 1, title: 'Phase 1', status: 'active' }],
      initialHintLevel: 2,
    });

    simulateMessage('coaching:message', {
      messageId: 'msg-1',
      message: 'Try this approach',
      type: 'hint',
      anchor: {
        path: '/test/file.ts',
        startLine: 5,
        startColumn: 1,
        endLine: 5,
        endColumn: 20,
      },
      source: 'coaching',
    });

    expect(screen.getByTestId('message-count').textContent).toBe('1');
    // At level 2 -> full balloon
    expect(screen.getByRole('tooltip')).toBeTruthy();
    expect(screen.getByText('Try this approach')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // 3. Explain source always shows full balloon regardless of level
  // -------------------------------------------------------------------------

  it('always shows explain source as full balloon regardless of level', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<TestHintingWrapper />);

    simulateMessage('session:start', {
      sessionId: 'test',
      issueContext: {
        number: 1,
        title: 'Test',
        url: 'https://github.com/test',
      },
      phases: [{ number: 1, title: 'Phase 1', status: 'active' }],
      initialHintLevel: 0,
    });

    simulateMessage('coaching:message', {
      messageId: 'explain-1',
      message: 'This is an explanation',
      type: 'info',
      anchor: {
        path: '/test/file.ts',
        startLine: 3,
        startColumn: 1,
        endLine: 3,
        endColumn: 10,
      },
      source: 'explain',
    });

    // Even at level 0, explain source shows as full balloon
    expect(screen.getByRole('tooltip')).toBeTruthy();
    expect(screen.getByText('This is an explanation')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // 4. Observer source always shows full balloon regardless of level
  // -------------------------------------------------------------------------

  it('always shows observer source as full balloon regardless of level', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<TestHintingWrapper />);

    simulateMessage('session:start', {
      sessionId: 'test',
      issueContext: {
        number: 1,
        title: 'Test',
        url: 'https://github.com/test',
      },
      phases: [{ number: 1, title: 'Phase 1', status: 'active' }],
      initialHintLevel: 0,
    });

    simulateMessage('coaching:message', {
      messageId: 'observe-1',
      message: 'Observer nudge',
      type: 'warning',
      anchor: {
        path: '/test/file.ts',
        startLine: 7,
        startColumn: 1,
        endLine: 7,
        endColumn: 15,
      },
      source: 'observer',
    });

    // Even at level 0, observer source shows as full balloon
    expect(screen.getByRole('tooltip')).toBeTruthy();
    expect(screen.getByText('Observer nudge')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // 5. Unanchored message shows as toast
  // -------------------------------------------------------------------------

  it('unanchored message shows as toast', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<TestHintingWrapper />);

    simulateMessage('coaching:message', {
      messageId: 'toast-1',
      message: 'General coaching advice',
      type: 'info',
      source: 'coaching',
      // No anchor!
    });

    expect(mockToast).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 6. Level change from 0 to 2 expands collapsed icons to balloons
  // -------------------------------------------------------------------------

  it('level change from 0 to 2 expands collapsed icons to balloons', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<TestHintingWrapper />);

    simulateMessage('session:start', {
      sessionId: 'test',
      issueContext: {
        number: 1,
        title: 'Test',
        url: 'https://github.com/test',
      },
      phases: [{ number: 1, title: 'Phase 1', status: 'active' }],
      initialHintLevel: 0,
    });

    simulateMessage('coaching:message', {
      messageId: 'msg-1',
      message: 'Hint content',
      type: 'hint',
      anchor: {
        path: '/test/file.ts',
        startLine: 5,
        startColumn: 1,
        endLine: 5,
        endColumn: 20,
      },
      source: 'coaching',
    });

    // At level 0 -> collapsed (no balloon)
    expect(screen.queryByRole('tooltip')).toBeNull();

    // Change level to 2
    fireEvent.click(screen.getByTestId('set-level-2'));

    // Now should be full balloon
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // 7. Clicking collapsed icon expands it permanently
  // -------------------------------------------------------------------------

  it('clicking collapsed icon expands it permanently', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<TestHintingWrapper />);

    simulateMessage('session:start', {
      sessionId: 'test',
      issueContext: {
        number: 1,
        title: 'Test',
        url: 'https://github.com/test',
      },
      phases: [{ number: 1, title: 'Phase 1', status: 'active' }],
      initialHintLevel: 0,
    });

    simulateMessage('coaching:message', {
      messageId: 'msg-1',
      message: 'Expand me',
      type: 'hint',
      anchor: {
        path: '/test/file.ts',
        startLine: 5,
        startColumn: 1,
        endLine: 5,
        endColumn: 20,
      },
      source: 'coaching',
    });

    // Click the collapsed icon
    const icon = screen.getByRole('button', { name: /expand hint message/i });
    fireEvent.click(icon);

    // Now shows as full balloon
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // 8. Review result activates review navigation
  // -------------------------------------------------------------------------

  it('coaching:review_result activates review navigation', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<TestHintingWrapper />);

    simulateMessage('coaching:review_result', {
      scope: 'current',
      comments: [
        {
          messageId: 'r1',
          path: '/test/file.ts',
          range: {
            startLine: 1,
            startColumn: 1,
            endLine: 1,
            endColumn: 10,
          },
          message: 'Review comment 1',
          type: 'hint',
        },
        {
          messageId: 'r2',
          path: '/test/file.ts',
          range: {
            startLine: 5,
            startColumn: 1,
            endLine: 5,
            endColumn: 10,
          },
          message: 'Review comment 2',
          type: 'info',
        },
      ],
    });

    expect(screen.getByTestId('review-active').textContent).toBe('true');
    expect(screen.getByTestId('review-count').textContent).toBe('2');
    expect(screen.getByTestId('review-index').textContent).toBe('0');
  });

  // -------------------------------------------------------------------------
  // 9. Review navigation next/previous updates index
  // -------------------------------------------------------------------------

  it('review navigation next/previous updates index', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<TestHintingWrapper />);

    simulateMessage('coaching:review_result', {
      scope: 'file',
      comments: [
        {
          messageId: 'r1',
          path: '/a.ts',
          range: {
            startLine: 1,
            startColumn: 1,
            endLine: 1,
            endColumn: 10,
          },
          message: 'C1',
          type: 'hint',
        },
        {
          messageId: 'r2',
          path: '/b.ts',
          range: {
            startLine: 1,
            startColumn: 1,
            endLine: 1,
            endColumn: 10,
          },
          message: 'C2',
          type: 'info',
        },
        {
          messageId: 'r3',
          path: '/c.ts',
          range: {
            startLine: 1,
            startColumn: 1,
            endLine: 1,
            endColumn: 10,
          },
          message: 'C3',
          type: 'success',
        },
      ],
    });

    expect(screen.getByTestId('review-index').textContent).toBe('0');

    fireEvent.click(screen.getByTestId('review-next'));
    expect(screen.getByTestId('review-index').textContent).toBe('1');

    fireEvent.click(screen.getByTestId('review-prev'));
    expect(screen.getByTestId('review-index').textContent).toBe('0');
  });

  // -------------------------------------------------------------------------
  // 10. Exit review resets navigation
  // -------------------------------------------------------------------------

  it('exit review resets navigation', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<TestHintingWrapper />);

    simulateMessage('coaching:review_result', {
      scope: 'current',
      comments: [
        {
          messageId: 'r1',
          path: '/a.ts',
          range: {
            startLine: 1,
            startColumn: 1,
            endLine: 1,
            endColumn: 10,
          },
          message: 'C1',
          type: 'hint',
        },
      ],
    });

    expect(screen.getByTestId('review-active').textContent).toBe('true');

    fireEvent.click(screen.getByTestId('review-exit'));

    expect(screen.getByTestId('review-active').textContent).toBe('false');
    expect(screen.getByTestId('review-count').textContent).toBe('0');
  });

  // -------------------------------------------------------------------------
  // 11. Phase transition clears coaching but not review
  // -------------------------------------------------------------------------

  it('phase:transition clears coaching but not review', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<TestHintingWrapper />);

    // Add a coaching message
    simulateMessage('coaching:message', {
      messageId: 'msg-1',
      message: 'Will be cleared',
      type: 'hint',
      anchor: {
        path: '/test/file.ts',
        startLine: 5,
        startColumn: 1,
        endLine: 5,
        endColumn: 20,
      },
      source: 'coaching',
    });

    // Start a review
    simulateMessage('coaching:review_result', {
      scope: 'current',
      comments: [
        {
          messageId: 'r1',
          path: '/a.ts',
          range: {
            startLine: 1,
            startColumn: 1,
            endLine: 1,
            endColumn: 10,
          },
          message: 'Review stays',
          type: 'hint',
        },
      ],
    });

    expect(screen.getByTestId('message-count').textContent).toBe('1');
    expect(screen.getByTestId('review-active').textContent).toBe('true');

    // Phase transition
    simulateMessage('phase:transition', {
      phaseNumber: 2,
      newStatus: 'active',
    });

    // Coaching cleared
    expect(screen.getByTestId('message-count').textContent).toBe('0');
    // Review preserved
    expect(screen.getByTestId('review-active').textContent).toBe('true');
    expect(screen.getByTestId('review-count').textContent).toBe('1');
  });

  // -------------------------------------------------------------------------
  // 12. Dismiss all coaching clears messages
  // -------------------------------------------------------------------------

  it('dismiss all coaching clears messages', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<TestHintingWrapper />);

    simulateMessage('coaching:message', {
      messageId: 'msg-1',
      message: 'Message 1',
      type: 'hint',
      anchor: {
        path: '/test/file.ts',
        startLine: 5,
        startColumn: 1,
        endLine: 5,
        endColumn: 20,
      },
      source: 'coaching',
    });

    simulateMessage('coaching:message', {
      messageId: 'msg-2',
      message: 'Message 2',
      type: 'info',
      source: 'coaching',
      // unanchored
    });

    expect(screen.getByTestId('message-count').textContent).toBe('2');

    fireEvent.click(screen.getByTestId('dismiss-all'));

    expect(screen.getByTestId('message-count').textContent).toBe('0');
  });
});
