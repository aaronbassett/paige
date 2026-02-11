/**
 * Integration tests for the editor workflow.
 *
 * Verifies the end-to-end flow from file open through WebSocket, to editing
 * content, saving, tab switching, closing (clean and dirty), and the empty
 * state splash screen. The tests render the full IDE view which internally
 * wires up useFileOperations, EditorTabs, CodeEditor, and StatusBar.
 *
 * Mocks:
 *   - useWebSocket: captures `on` handlers so tests can simulate server messages
 *   - @monaco-editor/react: textarea-based mock (no canvas in happy-dom)
 *   - framer-motion: passthrough divs (no animation runtime in tests)
 *   - theme utilities: no-op registration
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import type { WebSocketMessage } from '@shared/types/websocket-messages';

// ---------------------------------------------------------------------------
// Mock framer-motion — replace motion.div with plain div
// ---------------------------------------------------------------------------

vi.mock('framer-motion', () => {
  function passthrough(Tag: string) {
    function MotionPassthrough({
      children,
      animate: _animate,
      transition: _transition,
      ...rest
    }: React.HTMLAttributes<HTMLElement> & {
      animate?: unknown;
      transition?: unknown;
    }) {
      const El = Tag as React.ElementType;
      return <El {...rest}>{children}</El>;
    }
    MotionPassthrough.displayName = `motion.${Tag}`;
    return MotionPassthrough;
  }

  return {
    motion: {
      div: passthrough('div'),
      nav: passthrough('nav'),
      aside: passthrough('aside'),
      button: passthrough('button'),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// ---------------------------------------------------------------------------
// Mock Monaco Editor — textarea-based stub
// ---------------------------------------------------------------------------

vi.mock('@monaco-editor/react', () => ({
  default: ({
    value,
    language,
    onChange,
  }: {
    value?: string;
    language?: string;
    onChange?: (value: string) => void;
    onMount?: unknown;
    beforeMount?: unknown;
    path?: string;
    theme?: string;
    options?: unknown;
    loading?: React.ReactNode;
  }) => {
    return (
      <div data-testid="monaco-editor" data-language={language}>
        <textarea
          data-testid="monaco-textarea"
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </div>
    );
  },
}));

// ---------------------------------------------------------------------------
// Mock theme registration
// ---------------------------------------------------------------------------

vi.mock('../../renderer/src/utils/theme', () => ({
  PAIGE_DARK_THEME: 'paige-dark',
  registerPaigeDarkTheme: vi.fn(),
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
// Imports AFTER mocks
// ---------------------------------------------------------------------------

import { editorState } from '../../renderer/src/services/editor-state';
import { IDE } from '../../renderer/src/views/IDE';

// ---------------------------------------------------------------------------
// Handler capture helper (mirrors dashboard-workflow pattern)
// ---------------------------------------------------------------------------

/**
 * Captures the WebSocket message handlers registered by the IDE view (via
 * useFileOperations). After rendering, call `simulateMessage` to push data
 * into the component as if it arrived from the backend.
 */
function setupHandlerCapture(): {
  handlers: Record<string, (msg: WebSocketMessage) => void>;
  simulateMessage: (type: string, payload: unknown) => void;
} {
  const handlers: Record<string, (msg: WebSocketMessage) => void> = {};

  mockOn.mockImplementation((type: string, handler: (msg: WebSocketMessage) => void) => {
    handlers[type] = handler;
    return vi.fn(); // unsubscribe function
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
// Test data
// ---------------------------------------------------------------------------

function makeBufferContent(path: string, content: string, language: string) {
  return { path, content, language };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Editor workflow integration', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    editorState.closeAllTabs();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. File open via WebSocket
  // -------------------------------------------------------------------------

  it('opens a file tab when buffer:content arrives via WebSocket', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<IDE onNavigate={mockNavigate} />);

    // Simulate the backend responding with file content
    simulateMessage(
      'buffer:content',
      makeBufferContent('/src/index.ts', 'console.log("hello");', 'typescript'),
    );

    // Tab should appear in the tab strip
    const tablist = screen.getByRole('tablist', { name: 'Open files' });
    const tab = within(tablist).getByRole('tab', { name: /index\.ts/ });
    expect(tab).toBeInTheDocument();
    expect(tab).toHaveAttribute('aria-selected', 'true');

    // Monaco editor mock should render with the file content
    const editor = screen.getByTestId('monaco-editor');
    expect(editor).toHaveAttribute('data-language', 'typescript');

    const textarea = screen.getByTestId('monaco-textarea');
    expect(textarea).toHaveValue('console.log("hello");');
  });

  // -------------------------------------------------------------------------
  // 2. Edit marks tab dirty
  // -------------------------------------------------------------------------

  it('marks the tab as dirty when editor content changes', async () => {
    const { simulateMessage } = setupHandlerCapture();
    const user = userEvent.setup();
    render(<IDE onNavigate={mockNavigate} />);

    // Open a file
    simulateMessage(
      'buffer:content',
      makeBufferContent('/src/app.ts', 'const a = 1;', 'typescript'),
    );

    // Verify tab is initially clean
    let tab = screen.getByRole('tab', { name: /app\.ts/ });
    expect(tab).not.toHaveAccessibleName(/unsaved/);

    // Type into the editor (triggers onChange which calls setDirty)
    const textarea = screen.getByTestId('monaco-textarea');
    await user.click(textarea);
    await user.type(textarea, '// modified');

    // Tab should now show (unsaved) in its aria-label
    tab = screen.getByRole('tab', { name: /app\.ts \(unsaved\)/ });
    expect(tab).toBeInTheDocument();

    // Dirty dot indicator should be visible
    const dirtyIndicator = screen.getByLabelText('Unsaved changes');
    expect(dirtyIndicator).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 3. Save flow (save:ack clears dirty)
  // -------------------------------------------------------------------------

  it('clears dirty indicator when save:ack arrives from backend', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<IDE onNavigate={mockNavigate} />);

    // Open a file
    simulateMessage(
      'buffer:content',
      makeBufferContent('/src/save-test.ts', 'let x = 0;', 'typescript'),
    );

    // Mark it dirty via editorState (simulating an edit)
    act(() => {
      editorState.setDirty('/src/save-test.ts', 'let x = 1;');
    });

    // Verify dirty indicator appears
    expect(screen.getByRole('tab', { name: /save-test\.ts \(unsaved\)/ })).toBeInTheDocument();

    // Simulate save:ack from backend
    simulateMessage('save:ack', { path: '/src/save-test.ts', success: true });

    // Dirty indicator should be cleared -- tab name should no longer contain (unsaved)
    const tab = screen.getByRole('tab', { name: /save-test\.ts/ });
    expect(tab).not.toHaveAccessibleName(/unsaved/);
    expect(screen.queryByLabelText('Unsaved changes')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 4. Tab switching
  // -------------------------------------------------------------------------

  it('switches active tab when a different tab is clicked', async () => {
    const { simulateMessage } = setupHandlerCapture();
    const user = userEvent.setup();
    render(<IDE onNavigate={mockNavigate} />);

    // Open two files
    simulateMessage(
      'buffer:content',
      makeBufferContent('/src/first.ts', 'const first = true;', 'typescript'),
    );
    simulateMessage(
      'buffer:content',
      makeBufferContent('/src/second.ts', 'const second = true;', 'typescript'),
    );

    // Second file should be active (last opened)
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');

    // Editor should show second file's content
    expect(screen.getByTestId('monaco-textarea')).toHaveValue('const second = true;');

    // Click the first tab
    await user.click(tabs[0]!);

    // First tab should now be active
    const updatedTabs = screen.getAllByRole('tab');
    expect(updatedTabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(updatedTabs[1]).toHaveAttribute('aria-selected', 'false');

    // Editor should show first file's content
    expect(screen.getByTestId('monaco-textarea')).toHaveValue('const first = true;');
  });

  // -------------------------------------------------------------------------
  // 5. Close clean tab
  // -------------------------------------------------------------------------

  it('removes a clean tab when its close button is clicked', async () => {
    const { simulateMessage } = setupHandlerCapture();
    const user = userEvent.setup();
    render(<IDE onNavigate={mockNavigate} />);

    // Open a file
    simulateMessage(
      'buffer:content',
      makeBufferContent('/src/closeme.ts', 'const x = 42;', 'typescript'),
    );

    // Tab should exist
    expect(screen.getByRole('tab', { name: /closeme\.ts/ })).toBeInTheDocument();

    // Click the close button on the tab
    const closeButton = screen.getByLabelText('Close tab');
    await user.click(closeButton);

    // Tab should be removed -- no tablist should render (EditorTabs returns null for 0 tabs)
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();

    // The empty state splash should appear with the figlet ASCII art
    const emptyState = screen.getByRole('status', { name: 'No file open' });
    expect(emptyState).toBeInTheDocument();

    const figletHeader = emptyState.querySelector('.figlet-header');
    expect(figletHeader).not.toBeNull();
    expect(screen.getByText('Open a file to start coding')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 6. Close dirty tab with cancel
  // -------------------------------------------------------------------------

  it('keeps a dirty tab open when the user cancels the discard prompt', async () => {
    const { simulateMessage } = setupHandlerCapture();
    const user = userEvent.setup();

    // Stub window.confirm to return false (user cancels)
    const confirmMock = vi.fn().mockReturnValue(false);
    vi.stubGlobal('confirm', confirmMock);

    render(<IDE onNavigate={mockNavigate} />);

    // Open a file and mark it dirty
    simulateMessage(
      'buffer:content',
      makeBufferContent('/src/dirty.ts', 'const dirty = true;', 'typescript'),
    );
    act(() => {
      editorState.setDirty('/src/dirty.ts', 'const dirty = false;');
    });

    // Verify dirty state
    expect(screen.getByRole('tab', { name: /dirty\.ts \(unsaved\)/ })).toBeInTheDocument();

    // Click the dirty dot (which is the close button when not hovered)
    const dirtyDot = screen.getByLabelText('Unsaved changes');
    await user.click(dirtyDot);

    // Confirm dialog should have fired
    expect(confirmMock).toHaveBeenCalledWith('Discard unsaved changes to dirty.ts?');

    // Tab should still be there (user cancelled)
    expect(screen.getByRole('tab', { name: /dirty\.ts \(unsaved\)/ })).toBeInTheDocument();

    // Editor should still show content
    expect(screen.getByTestId('monaco-textarea')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  // -------------------------------------------------------------------------
  // 7. Empty state when no tabs
  // -------------------------------------------------------------------------

  it('shows the figlet PAIGE ASCII splash when no tabs are open', () => {
    setupHandlerCapture();
    render(<IDE onNavigate={mockNavigate} />);

    // No tabs open -- should show empty state
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();

    // The figlet-style PAIGE header should be visible
    const emptyState = screen.getByRole('status', { name: 'No file open' });
    expect(emptyState).toBeInTheDocument();

    // The pre tag with the ASCII art should be rendered via the figlet-header class
    const figletHeader = emptyState.querySelector('.figlet-header');
    expect(figletHeader).not.toBeNull();
    // The figlet ASCII art spells out "PAIGE" in block characters
    expect(figletHeader!.textContent).toContain('|_|');

    // The subtitle prompt should be present
    expect(screen.getByText('Open a file to start coding')).toBeInTheDocument();
  });
});
