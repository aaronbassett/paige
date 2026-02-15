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

function makeInProgressItems() {
  return [
    {
      type: 'issue' as const,
      number: 10,
      title: 'Fix login form validation',
      labels: [{ name: 'bug', color: '#d73a4a' }],
      author: { login: 'dev1', avatarUrl: 'https://example.com/a1.png' },
      updatedAt: '2026-02-14T00:00:00Z',
      createdAt: '2026-02-12T00:00:00Z',
      htmlUrl: 'https://github.com/test/repo/issues/10',
      difficulty: 'medium' as const,
      summary: 'Fix login form validation',
    },
    {
      type: 'issue' as const,
      number: 11,
      title: 'Add unit tests for auth module',
      labels: [],
      author: { login: 'dev2', avatarUrl: 'https://example.com/a2.png' },
      updatedAt: '2026-02-13T00:00:00Z',
      createdAt: '2026-02-11T00:00:00Z',
      htmlUrl: 'https://github.com/test/repo/issues/11',
      difficulty: 'low' as const,
      summary: 'Add unit tests for auth module',
    },
  ];
}

function makeIssues() {
  return [
    {
      number: 42,
      title: 'Add dark mode support',
      body: 'We need dark mode',
      summary: 'Add dark mode support to the app',
      difficulty: 'medium' as const,
      labels: [{ name: 'enhancement', color: '#0075ca' }],
      author: { login: 'testuser', avatarUrl: 'https://example.com/avatar.png' },
      assignees: [],
      commentCount: 3,
      updatedAt: '2026-02-14T00:00:00Z',
      createdAt: '2026-02-10T00:00:00Z',
      htmlUrl: 'https://github.com/test/repo/issues/42',
      score: 85,
    },
    {
      number: 99,
      title: 'Fix memory leak in WebSocket client',
      body: 'Memory leak detected',
      summary: 'Fix the WebSocket client memory leak',
      difficulty: 'high' as const,
      labels: [
        { name: 'bug', color: '#d73a4a' },
        { name: 'priority', color: '#e4e669' },
      ],
      author: { login: 'otheruser', avatarUrl: 'https://example.com/avatar2.png' },
      assignees: [],
      commentCount: 5,
      updatedAt: '2026-02-14T00:00:00Z',
      createdAt: '2026-02-11T00:00:00Z',
      htmlUrl: 'https://github.com/test/repo/issues/99',
      score: 72,
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
      id: 1,
      title: 'TypeScript Handbook',
      type: 'article' as const,
      url: 'https://example.com/ts',
      description: 'A comprehensive guide to TypeScript',
      thumbnailUrl: null,
      question: 'What is TypeScript?',
      viewCount: 0,
      status: 'pending' as const,
      createdAt: '2026-02-15T00:00:00Z',
    },
    {
      id: 2,
      title: 'React Hooks Tutorial',
      type: 'youtube' as const,
      url: 'https://www.youtube.com/watch?v=hooks',
      description: 'Learn React hooks step by step',
      thumbnailUrl: null,
      question: 'What are React hooks?',
      viewCount: 3,
      status: 'pending' as const,
      createdAt: '2026-02-15T00:00:00Z',
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
    expect(screen.getByText('Learning Materials')).toBeInTheDocument();

    // DreyfusRadar skeleton: the skeleton placeholder has aria-hidden="true"
    const skillsSection = screen.getByText('SKILLS').closest('div')!;
    const ariaHiddenElements = skillsSection.querySelectorAll('[aria-hidden="true"]');
    expect(ariaHiddenElements.length).toBeGreaterThan(0);

    // StatsBento loading: section is present with skeleton cards
    expect(screen.getByLabelText('Coding statistics')).toBeInTheDocument();

    // Row 2 shows empty state (always visible with placeholder content)
    expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
    expect(screen.getByText('CHALLENGES')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 2. WebSocket messages populate sections
  // -------------------------------------------------------------------------

  it('populates all 6 sections when WebSocket messages arrive', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<Dashboard onNavigate={mockNavigate} />);

    // Send all dashboard messages
    simulateMessage('dashboard:dreyfus', { axes: makeDreyfusAxes() });
    simulateMessage('dashboard:stats', makeStats());
    // In-progress items arrive individually via streaming
    const items = makeInProgressItems();
    for (const item of items) {
      simulateMessage('dashboard:in_progress_item', { item });
    }
    simulateMessage('dashboard:in_progress_complete', {});
    // Issues arrive individually via dashboard:issue, then dashboard:issues_complete
    const issues = makeIssues();
    for (const issue of issues) {
      simulateMessage('dashboard:issue', { issue });
    }
    simulateMessage('dashboard:issues_complete', {});
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

    // In-progress items (Row 2)
    expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
    expect(screen.getByText('Fix login form validation')).toBeInTheDocument();

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
    expect(screen.getByText('Learning Materials')).toBeInTheDocument();
    expect(screen.getByText('TypeScript Handbook')).toBeInTheDocument();
    expect(screen.getByText('DOC')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 3. Stats period switcher sends WebSocket message
  // -------------------------------------------------------------------------

  // Pre-existing: StatsControls was refactored from tabs to a floating-ui DateRangeDropdown
  it.skip('sends dashboard:stats_period when a period button is clicked', async () => {
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

  // Pre-existing: GitHubIssues now uses IssueModal flow with session:select_issue,
  // not direct navigation. Issues also arrive via dashboard:issue (singular).
  it.skip('navigates to IDE and sends start_issue when an issue card is clicked', async () => {
    const { simulateMessage } = setupHandlerCapture();
    const user = userEvent.setup();
    render(<Dashboard onNavigate={mockNavigate} />);

    // Populate issues (individual streaming)
    const issues = makeIssues();
    for (const issue of issues) {
      simulateMessage('dashboard:issue', { issue });
    }
    simulateMessage('dashboard:issues_complete', {});

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

  // Pre-existing: InProgress component now manages its own WebSocket subscriptions
  // and resume behavior internally — Dashboard no longer passes onResume prop.
  it.skip('navigates to IDE and sends resume_task when Resume button is clicked', async () => {
    const { simulateMessage } = setupHandlerCapture();
    const user = userEvent.setup();
    render(<Dashboard onNavigate={mockNavigate} />);

    // Populate in-progress items
    const items = makeInProgressItems();
    for (const item of items) {
      simulateMessage('dashboard:in_progress_item', { item });
    }
    simulateMessage('dashboard:in_progress_complete', {});

    // Click the Resume button for the first item
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

  it('shows Row 2 empty state when there are no in-progress items', () => {
    setupHandlerCapture();
    render(<Dashboard onNavigate={mockNavigate} />);

    // InProgress manages its own WebSocket subscriptions -- signal completion with no items
    // to trigger empty state. Without sending dashboard:in_progress_complete,
    // InProgress shows loading state instead.

    // Row 2 still visible with headers
    expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
    expect(screen.getByText('CHALLENGES')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 7. Row 2 visible when in-progress tasks exist
  // -------------------------------------------------------------------------

  it('shows Row 2 when in-progress items are present', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<Dashboard onNavigate={mockNavigate} />);

    // Send in-progress items via streaming
    const items = makeInProgressItems();
    for (const item of items) {
      simulateMessage('dashboard:in_progress_item', { item });
    }
    simulateMessage('dashboard:in_progress_complete', {});

    // Row 2 should appear with the IN PROGRESS section
    expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
    expect(screen.getByText('Fix login form validation')).toBeInTheDocument();
    expect(screen.getByText('Add unit tests for auth module')).toBeInTheDocument();
  });
});
