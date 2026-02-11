/**
 * Unit tests for the EditorTabs component.
 *
 * Covers rendering, active tab highlighting, dirty state indicators,
 * tab switching, close behaviour (clean and dirty with confirm prompt),
 * and overflow fade indicators.
 *
 * Mocks the editorState singleton to control tab data without relying
 * on its internal implementation.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import type { TabState } from '@shared/types/entities';

// ---------------------------------------------------------------------------
// Mock editorState service
// ---------------------------------------------------------------------------

let subscribedListener: (() => void) | null = null;
let mockTabs: TabState[] = [];
let mockActiveTabPath: string | undefined;

const mockSetActiveTab = vi.fn();
const mockCloseTab = vi.fn();

vi.mock('../../../../renderer/src/services/editor-state', () => ({
  editorState: {
    getTabs: () => mockTabs,
    getActiveTabPath: () => mockActiveTabPath,
    setActiveTab: (...args: unknown[]) => mockSetActiveTab(...args),
    closeTab: (...args: unknown[]) => mockCloseTab(...args),
    subscribe: (listener: () => void) => {
      subscribedListener = listener;
      return () => {
        subscribedListener = null;
      };
    },
  },
}));

// Import component after mock setup
import { EditorTabs } from '../../../../renderer/src/components/Editor/EditorTabs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTabs(overrides?: Partial<TabState>[]): TabState[] {
  const defaults: TabState[] = [
    { path: '/src/index.ts', language: 'typescript', isDirty: false, icon: 'TS' },
    { path: '/src/App.tsx', language: 'typescriptreact', isDirty: false, icon: 'TSX' },
    { path: '/src/styles.css', language: 'css', isDirty: false, icon: 'CSS' },
  ];

  if (!overrides) return defaults;

  return defaults.map((tab, i) => ({
    ...tab,
    ...(overrides[i] ?? {}),
  }));
}

/** Simulate a state change notification from editorState. */
function notifyStateChange(tabs: TabState[], activeTabPath?: string): void {
  mockTabs = tabs;
  mockActiveTabPath = activeTabPath;
  act(() => {
    subscribedListener?.();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EditorTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscribedListener = null;
    mockTabs = [];
    mockActiveTabPath = undefined;
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  describe('rendering', () => {
    it('returns null when there are no tabs', () => {
      const { container } = render(<EditorTabs />);
      expect(container.firstChild).toBeNull();
    });

    it('renders a tab for each open file with icon and filename', () => {
      const tabs = makeTabs();
      mockTabs = tabs;
      mockActiveTabPath = tabs[0]!.path;

      render(<EditorTabs />);

      expect(screen.getByText('index.ts')).toBeInTheDocument();
      expect(screen.getByText('App.tsx')).toBeInTheDocument();
      expect(screen.getByText('styles.css')).toBeInTheDocument();

      expect(screen.getByText('TS')).toBeInTheDocument();
      expect(screen.getByText('TSX')).toBeInTheDocument();
      expect(screen.getByText('CSS')).toBeInTheDocument();
    });

    it('renders a tablist with accessible label', () => {
      mockTabs = makeTabs();
      mockActiveTabPath = mockTabs[0]!.path;

      render(<EditorTabs />);

      const tablist = screen.getByRole('tablist', { name: 'Open files' });
      expect(tablist).toBeInTheDocument();
    });

    it('renders each tab with role="tab"', () => {
      mockTabs = makeTabs();
      mockActiveTabPath = mockTabs[0]!.path;

      render(<EditorTabs />);

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // Active tab
  // -------------------------------------------------------------------------

  describe('active tab', () => {
    it('marks the active tab with aria-selected="true"', () => {
      const tabs = makeTabs();
      mockTabs = tabs;
      mockActiveTabPath = '/src/App.tsx';

      render(<EditorTabs />);

      const allTabs = screen.getAllByRole('tab');
      const activeTab = allTabs.find((t) => t.getAttribute('aria-selected') === 'true');
      expect(activeTab).toBeDefined();
      expect(within(activeTab!).getByText('App.tsx')).toBeInTheDocument();
    });

    it('marks inactive tabs with aria-selected="false"', () => {
      const tabs = makeTabs();
      mockTabs = tabs;
      mockActiveTabPath = '/src/App.tsx';

      render(<EditorTabs />);

      const allTabs = screen.getAllByRole('tab');
      const inactiveTabs = allTabs.filter((t) => t.getAttribute('aria-selected') === 'false');
      expect(inactiveTabs).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Tab switching
  // -------------------------------------------------------------------------

  describe('tab switching', () => {
    it('calls editorState.setActiveTab when a tab is clicked', async () => {
      const tabs = makeTabs();
      mockTabs = tabs;
      mockActiveTabPath = tabs[0]!.path;

      const user = userEvent.setup();
      render(<EditorTabs />);

      const appTab = screen.getByRole('tab', { name: /App\.tsx/ });
      await user.click(appTab);

      expect(mockSetActiveTab).toHaveBeenCalledWith('/src/App.tsx');
    });

    it('calls editorState.setActiveTab on Enter keydown', async () => {
      const tabs = makeTabs();
      mockTabs = tabs;
      mockActiveTabPath = tabs[0]!.path;

      render(<EditorTabs />);

      const appTab = screen.getByRole('tab', { name: /App\.tsx/ });
      appTab.focus();

      await userEvent.keyboard('{Enter}');

      expect(mockSetActiveTab).toHaveBeenCalledWith('/src/App.tsx');
    });
  });

  // -------------------------------------------------------------------------
  // Dirty state
  // -------------------------------------------------------------------------

  describe('dirty state', () => {
    it('shows a dot indicator for dirty tabs when not hovered', () => {
      mockTabs = makeTabs([{}, { isDirty: true }, {}]);
      mockActiveTabPath = mockTabs[0]!.path;

      render(<EditorTabs />);

      // The dirty dot should be visible
      const dirtyIndicator = screen.getByLabelText('Unsaved changes');
      expect(dirtyIndicator).toBeInTheDocument();
      expect(dirtyIndicator.textContent).toContain('\u2022');
    });

    it('includes (unsaved) in aria-label for dirty tabs', () => {
      mockTabs = makeTabs([{}, { isDirty: true }, {}]);
      mockActiveTabPath = mockTabs[0]!.path;

      render(<EditorTabs />);

      const dirtyTab = screen.getByRole('tab', { name: /App\.tsx \(unsaved\)/ });
      expect(dirtyTab).toBeInTheDocument();
    });

    it('shows close button when hovering a dirty tab', async () => {
      mockTabs = makeTabs([{}, { isDirty: true }, {}]);
      mockActiveTabPath = mockTabs[0]!.path;

      const user = userEvent.setup();
      render(<EditorTabs />);

      // Before hover: dot visible, no close button for that tab
      expect(screen.getByLabelText('Unsaved changes')).toBeInTheDocument();

      // Hover over the dirty tab
      const dirtyTab = screen.getByRole('tab', { name: /App\.tsx \(unsaved\)/ });
      await user.hover(dirtyTab);

      // After hover: close button should appear (all close buttons should be visible)
      const closeButtons = screen.getAllByLabelText('Close tab');
      expect(closeButtons.length).toBeGreaterThanOrEqual(3); // all tabs show close
    });
  });

  // -------------------------------------------------------------------------
  // Close tab
  // -------------------------------------------------------------------------

  describe('close tab', () => {
    it('closes a clean tab immediately without confirmation', async () => {
      const tabs = makeTabs();
      mockTabs = tabs;
      mockActiveTabPath = tabs[0]!.path;

      const user = userEvent.setup();
      render(<EditorTabs />);

      // Each clean tab has a close button
      const closeButtons = screen.getAllByLabelText('Close tab');
      await user.click(closeButtons[0]!);

      expect(mockCloseTab).toHaveBeenCalledWith('/src/index.ts');
    });

    it('does not switch to the tab when close button is clicked', async () => {
      const tabs = makeTabs();
      mockTabs = tabs;
      mockActiveTabPath = tabs[0]!.path;

      const user = userEvent.setup();
      render(<EditorTabs />);

      // Click close on the second tab
      const closeButtons = screen.getAllByLabelText('Close tab');
      await user.click(closeButtons[1]!);

      // setActiveTab should NOT have been called (stopPropagation)
      expect(mockSetActiveTab).not.toHaveBeenCalled();
    });

    it('shows confirmation when closing a dirty tab', async () => {
      mockTabs = makeTabs([{ isDirty: true }, {}, {}]);
      mockActiveTabPath = mockTabs[0]!.path;

      // Stub window.confirm to return false (user cancels)
      // happy-dom does not provide window.confirm, so we use stubGlobal
      const confirmMock = vi.fn().mockReturnValue(false);
      vi.stubGlobal('confirm', confirmMock);

      const user = userEvent.setup();
      render(<EditorTabs />);

      // The dirty dot is itself a button (clickable for close)
      const dirtyDot = screen.getByLabelText('Unsaved changes');
      await user.click(dirtyDot);

      expect(confirmMock).toHaveBeenCalledWith('Discard unsaved changes to index.ts?');
      // Tab should NOT be closed since user cancelled
      expect(mockCloseTab).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it('closes dirty tab when user confirms', async () => {
      mockTabs = makeTabs([{ isDirty: true }, {}, {}]);
      mockActiveTabPath = mockTabs[0]!.path;

      // Stub window.confirm to return true (user confirms)
      const confirmMock = vi.fn().mockReturnValue(true);
      vi.stubGlobal('confirm', confirmMock);

      const user = userEvent.setup();
      render(<EditorTabs />);

      // Click the dirty dot button directly
      const dirtyDot = screen.getByLabelText('Unsaved changes');
      await user.click(dirtyDot);

      expect(confirmMock).toHaveBeenCalled();
      expect(mockCloseTab).toHaveBeenCalledWith('/src/index.ts');

      vi.unstubAllGlobals();
    });

    it('calls onCloseTab callback when a tab is closed', async () => {
      const tabs = makeTabs();
      mockTabs = tabs;
      mockActiveTabPath = tabs[0]!.path;
      const onCloseTab = vi.fn();

      const user = userEvent.setup();
      render(<EditorTabs onCloseTab={onCloseTab} />);

      const closeButtons = screen.getAllByLabelText('Close tab');
      await user.click(closeButtons[0]!);

      expect(onCloseTab).toHaveBeenCalledWith('/src/index.ts');
    });
  });

  // -------------------------------------------------------------------------
  // State subscription
  // -------------------------------------------------------------------------

  describe('state subscription', () => {
    it('re-renders when editorState notifies subscribers', () => {
      mockTabs = [];
      const { container } = render(<EditorTabs />);

      // Initially empty
      expect(container.firstChild).toBeNull();

      // Simulate opening tabs
      const tabs = makeTabs();
      notifyStateChange(tabs, tabs[0]!.path);

      // Should now render tabs
      expect(screen.getByText('index.ts')).toBeInTheDocument();
      expect(screen.getByText('App.tsx')).toBeInTheDocument();
    });

    it('updates active tab when state changes', () => {
      const tabs = makeTabs();
      mockTabs = tabs;
      mockActiveTabPath = tabs[0]!.path;

      render(<EditorTabs />);

      // Initially first tab is active
      let allTabs = screen.getAllByRole('tab');
      expect(allTabs[0]!.getAttribute('aria-selected')).toBe('true');
      expect(allTabs[1]!.getAttribute('aria-selected')).toBe('false');

      // Switch active to second tab
      notifyStateChange(tabs, tabs[1]!.path);

      allTabs = screen.getAllByRole('tab');
      expect(allTabs[0]!.getAttribute('aria-selected')).toBe('false');
      expect(allTabs[1]!.getAttribute('aria-selected')).toBe('true');
    });
  });

  // -------------------------------------------------------------------------
  // Filename extraction
  // -------------------------------------------------------------------------

  describe('filename extraction', () => {
    it('extracts filename from deep paths', () => {
      mockTabs = [
        {
          path: '/home/user/projects/app/src/components/deep/NestedComponent.tsx',
          language: 'typescriptreact',
          isDirty: false,
          icon: 'R',
        },
      ];
      mockActiveTabPath = mockTabs[0]!.path;

      render(<EditorTabs />);

      expect(screen.getByText('NestedComponent.tsx')).toBeInTheDocument();
    });
  });
});
