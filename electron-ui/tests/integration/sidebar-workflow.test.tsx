/**
 * Integration tests for the Coaching Sidebar workflow.
 *
 * Verifies the end-to-end flow: sidebar renders loading state before a session,
 * populates when session:start arrives (issue context, hint slider, phase stepper),
 * handles hint level changes, phase transitions, session restore, session end,
 * and step accordion expand interactions.
 *
 * Mocks:
 *   - framer-motion: motion.div as plain div, AnimatePresence as pass-through
 *   - useWebSocket: captures `on` handlers so tests can simulate server messages
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import type { WebSocketMessage } from '@shared/types/websocket-messages';

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
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ---------------------------------------------------------------------------
// Mock useWebSocket
// ---------------------------------------------------------------------------

const mockSend = vi.fn();
const mockOn = vi.fn();

vi.mock('../../renderer/src/hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    status: 'connected' as const,
    reconnectAttempt: 0,
    send: mockSend,
    on: mockOn,
  }),
}));

// ---------------------------------------------------------------------------
// Import the component after mocks are set up
// ---------------------------------------------------------------------------

import { CoachingSidebar } from '../../renderer/src/components/Sidebar/Sidebar';

// ---------------------------------------------------------------------------
// Handler capture helper
// ---------------------------------------------------------------------------

/**
 * Captures the WebSocket message handlers registered by CoachingSidebar and
 * its child hooks (useHintLevel also registers session:start / session:restore).
 *
 * Supports multiple handlers per message type since both the Sidebar and
 * useHintLevel register separate handlers for session:start and session:restore.
 *
 * After rendering, call `simulateMessage` to push data into the component
 * as if it arrived from the backend.
 */
function setupHandlerCapture(): {
  handlers: Map<string, Array<(msg: WebSocketMessage) => void>>;
  simulateMessage: (type: string, payload: unknown) => void;
} {
  const handlers = new Map<string, Array<(msg: WebSocketMessage) => void>>();

  mockOn.mockImplementation((type: string, handler: (msg: WebSocketMessage) => void) => {
    const existing = handlers.get(type) ?? [];
    existing.push(handler);
    handlers.set(type, existing);
    return vi.fn(); // unsubscribe
  });

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
// Test data factories
// ---------------------------------------------------------------------------

function makeSessionStartPayload(overrides?: Record<string, unknown>) {
  return {
    sessionId: 'test-session',
    issueContext: {
      number: 42,
      title: 'Fix login bug',
      summary: 'Users cannot log in with special characters',
      labels: [{ name: 'bug', color: '#d73a4a' }],
      url: 'https://github.com/test/repo/issues/42',
    },
    phases: [
      {
        number: 1,
        title: 'Understand',
        status: 'active',
        summary: 'Read the code',
      },
      { number: 2, title: 'Plan', status: 'pending' },
      { number: 3, title: 'Implement', status: 'pending' },
      { number: 4, title: 'Test', status: 'pending' },
      { number: 5, title: 'Review', status: 'pending' },
    ],
    initialHintLevel: 1,
    ...overrides,
  };
}

function makeSessionStartWithStepsPayload() {
  return {
    sessionId: 'test-session',
    issueContext: {
      number: 42,
      title: 'Fix login bug',
      summary: 'Users cannot log in with special characters',
      labels: [{ name: 'bug', color: '#d73a4a' }],
      url: 'https://github.com/test/repo/issues/42',
    },
    phases: [
      {
        number: 1,
        title: 'Understand',
        status: 'active',
        summary: 'Read the code',
        steps: [
          {
            title: 'Read the file',
            description: 'Open main.ts and read through it',
          },
          {
            title: 'Identify the bug',
            description: 'Look for the login handler',
          },
        ],
      },
      { number: 2, title: 'Plan', status: 'pending' },
      { number: 3, title: 'Implement', status: 'pending' },
      { number: 4, title: 'Test', status: 'pending' },
      { number: 5, title: 'Review', status: 'pending' },
    ],
    initialHintLevel: 3,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Coaching sidebar workflow integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Loading state before session starts
  // -------------------------------------------------------------------------

  it('renders loading state before session starts', () => {
    setupHandlerCapture();
    render(<CoachingSidebar />);

    // Should show the waiting placeholder
    expect(screen.getByText('Waiting for session...')).toBeInTheDocument();

    // Should NOT show issue context, slider, or stepper
    expect(screen.queryByLabelText('Issue context')).not.toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Coaching phases')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 2. Populates sidebar when session:start arrives
  // -------------------------------------------------------------------------

  it('populates sidebar when session:start arrives', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<CoachingSidebar />);

    simulateMessage('session:start', makeSessionStartPayload());

    // Issue number visible
    expect(screen.getByText('#42')).toBeInTheDocument();

    // Issue title visible
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();

    // Bug label pill visible
    expect(screen.getByText('bug')).toBeInTheDocument();

    // Phase titles visible
    expect(screen.getByText('Understand')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Implement')).toBeInTheDocument();
    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();

    // HintSlider is rendered (check for role="slider")
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 3. Slider changes hint level
  // -------------------------------------------------------------------------

  it('slider changes hint level', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<CoachingSidebar />);

    // Start session with hint level 1
    simulateMessage('session:start', makeSessionStartPayload());

    // Find and click the "Heavy" label (level 3)
    const heavyLabel = screen.getByTestId('hint-label-3');
    fireEvent.click(heavyLabel);

    // Verify the slider value updates to level 3
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuenow', '3');

    // Verify the Heavy label is marked active
    expect(heavyLabel).toHaveAttribute('data-active', 'true');
  });

  // -------------------------------------------------------------------------
  // 4. Phase transition updates stepper
  // -------------------------------------------------------------------------

  it('phase transition updates stepper', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<CoachingSidebar />);

    // Start session with phase 1 active, phases 2-5 pending
    simulateMessage('session:start', makeSessionStartPayload());

    // Verify phase 1 is active
    expect(screen.getByTestId('indicator-active')).toBeInTheDocument();

    // Transition: phase 1 -> complete
    simulateMessage('phase:transition', {
      phaseNumber: 1,
      newStatus: 'complete',
    });

    // Transition: phase 2 -> active
    simulateMessage('phase:transition', {
      phaseNumber: 2,
      newStatus: 'active',
    });

    // Phase 1 shows complete indicator (checkmark)
    const completeIndicators = screen.getAllByTestId('indicator-complete');
    expect(completeIndicators.length).toBeGreaterThanOrEqual(1);

    // Phase 2 shows active indicator
    const activeIndicators = screen.getAllByTestId('indicator-active');
    expect(activeIndicators.length).toBe(1);

    // Verify checkmark character is present in the complete indicator
    expect(completeIndicators[0]!.textContent).toContain('\u2713');
  });

  // -------------------------------------------------------------------------
  // 5. Session restore repopulates sidebar
  // -------------------------------------------------------------------------

  it('session:restore repopulates sidebar', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<CoachingSidebar />);

    // Verify initial loading state
    expect(screen.getByText('Waiting for session...')).toBeInTheDocument();

    // Simulate session:restore with different data
    simulateMessage('session:restore', {
      sessionId: 'restored-session',
      issueContext: {
        number: 99,
        title: 'Add dark mode',
        summary: 'Implement dark mode toggle',
        labels: [{ name: 'enhancement', color: '#0075ca' }],
        url: 'https://github.com/test/repo/issues/99',
      },
      phases: [
        {
          number: 1,
          title: 'Understand',
          status: 'complete',
          summary: 'Read the code',
        },
        {
          number: 2,
          title: 'Plan',
          status: 'active',
          summary: 'Design the approach',
        },
        { number: 3, title: 'Implement', status: 'pending' },
        { number: 4, title: 'Test', status: 'pending' },
        { number: 5, title: 'Review', status: 'pending' },
      ],
      openTabs: [],
      activeTabPath: '',
      hintLevel: 2,
    });

    // Verify sidebar repopulated with restored data
    expect(screen.queryByText('Waiting for session...')).not.toBeInTheDocument();
    expect(screen.getByText('#99')).toBeInTheDocument();
    expect(screen.getByText('Add dark mode')).toBeInTheDocument();
    expect(screen.getByText('enhancement')).toBeInTheDocument();

    // Verify phase 1 is complete and phase 2 is active
    expect(screen.getByTestId('indicator-complete')).toBeInTheDocument();
    expect(screen.getByTestId('indicator-active')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 6. Session end clears sidebar back to loading state
  // -------------------------------------------------------------------------

  it('session:end clears sidebar back to loading state', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<CoachingSidebar />);

    // Populate sidebar
    simulateMessage('session:start', makeSessionStartPayload());
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();

    // End session
    simulateMessage('session:end', {
      sessionId: 'test-session',
      reason: 'completed',
    });

    // Verify sidebar returns to loading state
    expect(screen.getByText('Waiting for session...')).toBeInTheDocument();
    expect(screen.queryByText('Fix login bug')).not.toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Coaching phases')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 7. Expanding phase step sends WebSocket message
  // -------------------------------------------------------------------------

  it('expanding phase step sends WebSocket message', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<CoachingSidebar />);

    // Start session with hint level 3 and steps on active phase
    simulateMessage('session:start', makeSessionStartWithStepsPayload());

    // At hint level 3, steps should be rendered as accordion buttons
    const stepButton = screen.getByLabelText('Step: Read the file');
    fireEvent.click(stepButton);

    // Verify send was called with phase:expand_step and correct payload
    expect(mockSend).toHaveBeenCalledWith('phase:expand_step', {
      phaseNumber: 1,
      stepIndex: 0,
    });
  });
});
