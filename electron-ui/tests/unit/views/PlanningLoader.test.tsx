/**
 * Unit tests for the PlanningLoader view.
 *
 * Covers:
 * - ASCII banner rendering
 * - ProgressBar and ActivityLog composition
 * - Issue title display when provided
 * - onComplete callback with delay when status is 'complete'
 * - onError callback when status is 'error'
 * - Error state rendering with retry button
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type {
  PlanningCompletePayload,
  PlanningPhase,
} from '@shared/types/websocket-messages';
import type {
  PlanningStatus,
  LogEntry,
  PlanningProgressState,
} from '../../../renderer/src/hooks/usePlanningProgress';

// ---------------------------------------------------------------------------
// Mock framer-motion -- motion.pre, motion.div, motion.p as plain elements
// ---------------------------------------------------------------------------

vi.mock('framer-motion', () => ({
  motion: {
    pre: ({
      children,
      animate: _a,
      initial: _i,
      exit: _e,
      transition: _t,
      ...rest
    }: React.HTMLAttributes<HTMLPreElement> & {
      animate?: unknown;
      initial?: unknown;
      exit?: unknown;
      transition?: unknown;
    }) => <pre {...rest}>{children}</pre>,
    div: ({
      children,
      animate: _a,
      initial: _i,
      exit: _e,
      transition: _t,
      ...rest
    }: React.HTMLAttributes<HTMLDivElement> & {
      animate?: unknown;
      initial?: unknown;
      exit?: unknown;
      transition?: unknown;
    }) => <div {...rest}>{children}</div>,
    p: ({
      children,
      animate: _a,
      initial: _i,
      exit: _e,
      transition: _t,
      ...rest
    }: React.HTMLAttributes<HTMLParagraphElement> & {
      animate?: unknown;
      initial?: unknown;
      exit?: unknown;
      transition?: unknown;
    }) => <p {...rest}>{children}</p>,
  },
}));

// ---------------------------------------------------------------------------
// Mock usePlanningProgress hook
// ---------------------------------------------------------------------------

let mockState: PlanningProgressState = {
  status: 'idle',
  issueTitle: null,
  currentPhase: null,
  progress: 0,
  logs: [],
  result: null,
  error: null,
};

vi.mock('../../../renderer/src/hooks/usePlanningProgress', () => ({
  usePlanningProgress: () => mockState,
}));

// ---------------------------------------------------------------------------
// Mock child components for isolation
// ---------------------------------------------------------------------------

vi.mock('../../../renderer/src/components/planning/ProgressBar', () => ({
  ProgressBar: (props: { currentPhase: PlanningPhase | null; progress: number }) => (
    <div data-testid="progress-bar" data-phase={props.currentPhase} data-progress={props.progress} />
  ),
}));

vi.mock('../../../renderer/src/components/planning/ActivityLog', () => ({
  ActivityLog: (props: { logs: LogEntry[] }) => (
    <div data-testid="activity-log" data-log-count={props.logs.length} />
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COMPLETE_PAYLOAD: PlanningCompletePayload = {
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

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
  mockState = {
    status: 'idle',
    issueTitle: null,
    currentPhase: null,
    progress: 0,
    logs: [],
    result: null,
    error: null,
  };
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Import component under test (after mocks are set up)
// ---------------------------------------------------------------------------

// Dynamic import not needed: vi.mock is hoisted automatically by Vitest.
import { PlanningLoader } from '../../../renderer/src/views/PlanningLoader';

// ===========================================================================
// Tests
// ===========================================================================

describe('PlanningLoader', () => {
  // -------------------------------------------------------------------------
  // ASCII banner
  // -------------------------------------------------------------------------

  it('renders the PAIGE ASCII banner', () => {
    render(<PlanningLoader onComplete={vi.fn()} />);
    // The ASCII art is rendered as figlet slant-font glyphs, not literal "PAIGE".
    // Match a unique substring from the first line of the ASCII art.
    expect(screen.getByText(/____\s+___\s+____________/)).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Child components
  // -------------------------------------------------------------------------

  it('renders the ProgressBar component', () => {
    render(<PlanningLoader onComplete={vi.fn()} />);
    expect(screen.getByTestId('progress-bar')).toBeTruthy();
  });

  it('renders the ActivityLog component', () => {
    render(<PlanningLoader onComplete={vi.fn()} />);
    expect(screen.getByTestId('activity-log')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Props passed to children
  // -------------------------------------------------------------------------

  it('passes currentPhase and progress to ProgressBar', () => {
    mockState = {
      ...mockState,
      status: 'loading',
      currentPhase: 'exploring',
      progress: 45,
    };

    render(<PlanningLoader onComplete={vi.fn()} />);
    const bar = screen.getByTestId('progress-bar');
    expect(bar.getAttribute('data-phase')).toBe('exploring');
    expect(bar.getAttribute('data-progress')).toBe('45');
  });

  it('passes logs to ActivityLog', () => {
    mockState = {
      ...mockState,
      status: 'loading',
      logs: [
        { message: 'Reading file...', timestamp: 1000 },
        { message: 'Analyzing code...', timestamp: 2000 },
      ],
    };

    render(<PlanningLoader onComplete={vi.fn()} />);
    const log = screen.getByTestId('activity-log');
    expect(log.getAttribute('data-log-count')).toBe('2');
  });

  // -------------------------------------------------------------------------
  // Issue title
  // -------------------------------------------------------------------------

  it('shows issue title when provided', () => {
    mockState = {
      ...mockState,
      status: 'loading',
      issueTitle: 'Fix login bug',
    };

    render(<PlanningLoader onComplete={vi.fn()} />);
    expect(screen.getByText(/Preparing: Fix login bug/)).toBeTruthy();
  });

  it('does not show issue title when null', () => {
    mockState = {
      ...mockState,
      status: 'idle',
      issueTitle: null,
    };

    render(<PlanningLoader onComplete={vi.fn()} />);
    expect(screen.queryByText(/Preparing:/)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Completion
  // -------------------------------------------------------------------------

  it('calls onComplete after 600ms delay when status is complete', () => {
    const onComplete = vi.fn();
    mockState = {
      ...mockState,
      status: 'complete',
      result: COMPLETE_PAYLOAD,
      progress: 100,
    };

    render(<PlanningLoader onComplete={onComplete} />);

    // Not called immediately
    expect(onComplete).not.toHaveBeenCalled();

    // Advance past delay
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(COMPLETE_PAYLOAD);
  });

  it('does not call onComplete when status is not complete', () => {
    const onComplete = vi.fn();
    mockState = {
      ...mockState,
      status: 'loading',
      result: null,
    };

    render(<PlanningLoader onComplete={onComplete} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onComplete).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  it('calls onError when status is error', () => {
    const onError = vi.fn();
    mockState = {
      ...mockState,
      status: 'error',
      error: 'API rate limit exceeded',
    };

    render(<PlanningLoader onComplete={vi.fn()} onError={onError} />);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('API rate limit exceeded');
  });

  it('renders error message when status is error', () => {
    mockState = {
      ...mockState,
      status: 'error',
      error: 'Something went wrong',
    };

    render(<PlanningLoader onComplete={vi.fn()} />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('renders retry button when onRetry is provided and status is error', async () => {
    const onRetry = vi.fn();
    mockState = {
      ...mockState,
      status: 'error',
      error: 'Network timeout',
    };

    // Use real timers for userEvent
    vi.useRealTimers();

    render(<PlanningLoader onComplete={vi.fn()} onRetry={onRetry} />);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeTruthy();

    const user = userEvent.setup();
    await user.click(retryButton);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not render retry button when onRetry is not provided', () => {
    mockState = {
      ...mockState,
      status: 'error',
      error: 'Something failed',
    };

    render(<PlanningLoader onComplete={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });
});
