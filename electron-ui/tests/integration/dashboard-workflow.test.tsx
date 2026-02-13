/**
 * Integration tests for the Dashboard view component.
 *
 * Verifies the end-to-end workflow: Dashboard renders with loading skeletons,
 * populates sections when WebSocket messages arrive, handles user interactions
 * (period switching, issue clicks, task resume), and conditionally shows/hides
 * Row 2 based on in-progress tasks and challenges data.
 *
 * Mocks the useWebSocket hook to avoid real WebSocket connections while still
 * testing the component's subscription and dispatch behavior.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import type { WebSocketMessage } from '@shared/types/websocket-messages';

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

// Import the component after the mock is set up
import { Dashboard } from '../../renderer/src/views/Dashboard';

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeDreyfusAxes() {
  return [
    { skill: 'TypeScript', level: 3 as const },
    { skill: 'React', level: 2 as const },
    { skill: 'Testing', level: 4 as const },
    { skill: 'Git', level: 1 as const },
    { skill: 'CSS', level: 5 as const },
  ];
}

function makeStats() {
  return {
    period: 'this_week' as const,
    stats: {
      lines_changed: { value: 1234, change: 12, unit: 'count' as const },
      files_touched: { value: 42, change: -3, unit: 'count' as const },
      sessions: { value: 15, change: 5, unit: 'count' as const },
      actions: { value: 89, change: 0, unit: 'count' as const },
      issues_started: { value: 3, change: 50, unit: 'count' as const },
      reviews_requested: { value: 7, change: 10, unit: 'count' as const },
      dreyfus_progression: { value: 'Novice', change: 0, unit: 'text' as const },
      self_sufficiency: { value: 72, change: 3.2, unit: 'percentage' as const },
    },
  };
}

function makeInProgressTasks() {
  return [
    { id: 'task-1', title: 'Fix login form validation', progress: 65 },
    { id: 'task-2', title: 'Add unit tests for auth module', progress: 30, dueDate: '2026-02-15' },
  ];
}

function makeIssues() {
  return [
    {
      number: 42,
      title: 'Add dark mode support',
      labels: [{ name: 'enhancement', color: '#0075ca' }],
      url: 'https://github.com/test/repo/issues/42',
    },
    {
      number: 99,
      title: 'Fix memory leak in WebSocket client',
      labels: [
        { name: 'bug', color: '#d73a4a' },
        { name: 'priority', color: '#e4e669' },
      ],
      url: 'https://github.com/test/repo/issues/99',
    },
  ];
}

function makeChallenges() {
  return [
    { id: 'ch-1', title: 'Binary Search', difficulty: 'easy' as const, estimatedMinutes: 15 },
    { id: 'ch-2', title: 'Merge Sort', difficulty: 'medium' as const, estimatedMinutes: 30 },
  ];
}

function makeMaterials() {
  return [
    {
      id: 'mat-1',
      title: 'TypeScript Handbook',
      type: 'article' as const,
      url: 'https://example.com/ts',
    },
    {
      id: 'mat-2',
      title: 'React Hooks Tutorial',
      type: 'tutorial' as const,
      url: 'https://example.com/hooks',
    },
  ];
}

// ---------------------------------------------------------------------------
// Handler capture helper
// ---------------------------------------------------------------------------

/**
 * Captures the WebSocket message handlers that the Dashboard registers via
 * the `on` function. After rendering, call `simulateMessage` to push data
 * into the component as if it arrived from the backend.
 */
function setupHandlerCapture(): {
  handlers: Record<string, (msg: WebSocketMessage) => void>;
  simulateMessage: (type: string, payload: unknown) => void;
} {
  const handlers: Record<string, (msg: WebSocketMessage) => void> = {};

  mockOn.mockImplementation((type: string, handler: (msg: WebSocketMessage) => void) => {
    handlers[type] = handler;
    return vi.fn(); // unsubscribe
  });

  const simulateMessage = (type: string, payload: unknown) => {
    act(() => {
      handlers[type]?.({
        type,
        payload,
        timestamp: Date.now(),
      } as WebSocketMessage);
    });
  };

  return { handlers, simulateMessage };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Dashboard integration', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Loading state
  // -------------------------------------------------------------------------

  it('renders loading skeletons initially when all data is null', () => {
    setupHandlerCapture();
    render(<Dashboard onNavigate={mockNavigate} />);

    // All 6 section headers should be present
    expect(screen.getByText('SKILLS')).toBeInTheDocument();
    expect(screen.getByText('STATS')).toBeInTheDocument();
    expect(screen.getByText('ISSUES')).toBeInTheDocument();
    expect(screen.getByText('MATERIALS')).toBeInTheDocument();

    // DreyfusRadar skeleton: the skeleton placeholder has aria-hidden="true"
    const skillsSection = screen.getByText('SKILLS').closest('div')!;
    const ariaHiddenElements = skillsSection.querySelectorAll('[aria-hidden="true"]');
    expect(ariaHiddenElements.length).toBeGreaterThan(0);

    // StatsBento loading: aria-busy="true" on the grid
    const statsSection = screen.getByLabelText('Coding statistics');
    const busyGrid = within(statsSection).getByRole('status');
    expect(busyGrid).toHaveAttribute('aria-busy', 'true');

    // Row 2 should NOT be visible (no in-progress tasks, no challenges)
    expect(screen.queryByText('IN PROGRESS')).not.toBeInTheDocument();
    expect(screen.queryByText('CHALLENGES')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 2. WebSocket messages populate sections
  // -------------------------------------------------------------------------

  it('populates all 6 sections when WebSocket messages arrive', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<Dashboard onNavigate={mockNavigate} />);

    // Send all 6 dashboard messages
    simulateMessage('dashboard:dreyfus', { axes: makeDreyfusAxes() });
    simulateMessage('dashboard:stats', makeStats());
    simulateMessage('dashboard:in_progress', { tasks: makeInProgressTasks() });
    simulateMessage('dashboard:issues', { issues: makeIssues() });
    simulateMessage('dashboard:challenges', { challenges: makeChallenges() });
    simulateMessage('dashboard:materials', { materials: makeMaterials() });

    // Dreyfus radar: should render skill labels in the chart
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();

    // Dreyfus radar: stage pill and self-sufficiency (from stats)
    expect(screen.getByTestId('stage-pill')).toHaveTextContent('Novice');
    expect(screen.getByTestId('self-sufficiency-value')).toHaveTextContent('72%');

    // Stats bento: should show stat labels from catalog
    expect(screen.getByText('Sessions')).toBeInTheDocument();

    // In-progress tasks (Row 2)
    expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
    expect(screen.getByText('Fix login form validation')).toBeInTheDocument();
    expect(screen.getByText('65%')).toBeInTheDocument();

    // Challenges (Row 2)
    expect(screen.getByText('CHALLENGES')).toBeInTheDocument();
    expect(screen.getByText('Binary Search')).toBeInTheDocument();
    expect(screen.getByText('easy')).toBeInTheDocument();

    // GitHub issues
    expect(screen.getByText('ISSUES')).toBeInTheDocument();
    expect(screen.getByText('Add dark mode support')).toBeInTheDocument();
    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.getByText('enhancement')).toBeInTheDocument();

    // Learning materials
    expect(screen.getByText('MATERIALS')).toBeInTheDocument();
    expect(screen.getByText('TypeScript Handbook')).toBeInTheDocument();
    expect(screen.getByText('DOC')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 3. Stats period switcher sends WebSocket message
  // -------------------------------------------------------------------------

  it('sends dashboard:stats_period when a period button is clicked', async () => {
    const { simulateMessage } = setupHandlerCapture();
    const user = userEvent.setup();
    render(<Dashboard onNavigate={mockNavigate} />);

    // Populate stats so the switcher renders with a meaningful active period
    simulateMessage('dashboard:stats', makeStats());

    // Click "Today" tab
    const todayTab = screen.getByRole('tab', { name: 'Today' });
    await user.click(todayTab);

    expect(mockSend).toHaveBeenCalledWith('dashboard:stats_period', { period: 'today' });

    // Click "This Month" tab
    const monthTab = screen.getByRole('tab', { name: 'This Month' });
    await user.click(monthTab);

    expect(mockSend).toHaveBeenCalledWith('dashboard:stats_period', { period: 'this_month' });
  });

  // -------------------------------------------------------------------------
  // 4. Issue card click navigates to IDE
  // -------------------------------------------------------------------------

  it('navigates to IDE and sends start_issue when an issue card is clicked', async () => {
    const { simulateMessage } = setupHandlerCapture();
    const user = userEvent.setup();
    render(<Dashboard onNavigate={mockNavigate} />);

    // Populate issues
    simulateMessage('dashboard:issues', { issues: makeIssues() });

    // Click the first issue card (#42)
    const issueCard = screen.getByRole('button', { name: /Issue #42/ });
    await user.click(issueCard);

    // Should dispatch dashboard:start_issue with the issue number
    expect(mockSend).toHaveBeenCalledWith('dashboard:start_issue', { issueNumber: 42 });

    // Should call onNavigate with 'ide' and the issue number
    expect(mockNavigate).toHaveBeenCalledWith('ide', { issueNumber: 42 });
  });

  // -------------------------------------------------------------------------
  // 5. In-progress task resume navigates to IDE
  // -------------------------------------------------------------------------

  it('navigates to IDE and sends resume_task when Resume button is clicked', async () => {
    const { simulateMessage } = setupHandlerCapture();
    const user = userEvent.setup();
    render(<Dashboard onNavigate={mockNavigate} />);

    // Populate in-progress tasks
    simulateMessage('dashboard:in_progress', { tasks: makeInProgressTasks() });
    // Also need challenges or tasks to make Row 2 visible
    // (tasks alone are sufficient since hasInProgressTasks will be true)

    // Click the Resume button for the first task
    const resumeButton = screen.getByRole('button', {
      name: /Resume task: Fix login form validation/,
    });
    await user.click(resumeButton);

    // Should dispatch dashboard:resume_task with the task ID
    expect(mockSend).toHaveBeenCalledWith('dashboard:resume_task', { taskId: 'task-1' });

    // Should navigate to IDE
    expect(mockNavigate).toHaveBeenCalledWith('ide');
  });

  // -------------------------------------------------------------------------
  // 6. Row 2 hidden when no in-progress tasks and no challenges
  // -------------------------------------------------------------------------

  it('hides Row 2 when there are no in-progress tasks and no challenges', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<Dashboard onNavigate={mockNavigate} />);

    // Send empty in-progress tasks and leave challenges as null (never sent)
    simulateMessage('dashboard:in_progress', { tasks: [] });

    // Row 2 sections should not be visible
    expect(screen.queryByText('IN PROGRESS')).not.toBeInTheDocument();
    expect(screen.queryByText('CHALLENGES')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 7. Row 2 visible when in-progress tasks exist
  // -------------------------------------------------------------------------

  it('shows Row 2 when in-progress tasks are present', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<Dashboard onNavigate={mockNavigate} />);

    // Send in-progress tasks with data
    simulateMessage('dashboard:in_progress', { tasks: makeInProgressTasks() });

    // Row 2 should appear with the IN PROGRESS section
    expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
    expect(screen.getByText('Fix login form validation')).toBeInTheDocument();
    expect(screen.getByText('Add unit tests for auth module')).toBeInTheDocument();

    // Resume buttons should be present
    expect(screen.getAllByText('Resume')).toHaveLength(2);
  });
});
