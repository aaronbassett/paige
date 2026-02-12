/**
 * Integration tests for the Terminal workflow.
 *
 * Verifies the end-to-end flow: xterm.js initialization, PTY bridge
 * communication (bidirectional data, exit handling), WebSocket terminal:ready
 * message, observer nudge forwarding, and fallback when PTY bridge is absent.
 *
 * Mocks:
 *   - @xterm/xterm: Terminal class mock with call tracking
 *   - @xterm/addon-fit: FitAddon mock (no-op fit)
 *   - @xterm/xterm/css/xterm.css: empty module (no CSS in tests)
 *   - window.paige.terminal: PTY bridge mock with callback capture
 *   - useWebSocket: captures `on` handlers so tests can simulate server messages
 */

import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import type { WebSocketMessage } from '@shared/types/websocket-messages';

// ---------------------------------------------------------------------------
// Hoisted state shared between vi.mock factories and test body
// ---------------------------------------------------------------------------

const {
  mockSend,
  mockOn,
  mockTermInstance,
  mockFitAddonInstance,
  MockTerminal,
  MockFitAddon,
  ptyCallbacks,
} = vi.hoisted(() => {
  /** Captured callbacks from xterm Terminal.onData and Terminal.onResize. */
  let capturedOnData: ((data: string) => void) | null = null;
  let capturedOnResize: ((size: { cols: number; rows: number }) => void) | null = null;

  /** Captured callbacks from PTY bridge onData and onExit. */
  const ptyCallbacks = {
    onData: null as ((data: string) => void) | null,
    onExit: null as ((info: { code: number; signal?: number }) => void) | null,
  };

  /** Mock xterm Terminal instance -- shared so tests can assert on calls. */
  const mockTermInstance = {
    open: vi.fn(),
    write: vi.fn(),
    writeln: vi.fn(),
    dispose: vi.fn(),
    loadAddon: vi.fn(),
    cols: 80,
    rows: 24,
    onData: vi.fn((cb: (data: string) => void) => {
      capturedOnData = cb;
      return { dispose: vi.fn() };
    }),
    onResize: vi.fn((cb: (size: { cols: number; rows: number }) => void) => {
      capturedOnResize = cb;
      return { dispose: vi.fn() };
    }),
    /** Helper: simulate user typing into the terminal. */
    simulateUserInput(data: string) {
      capturedOnData?.(data);
    },
    /** Helper: simulate a terminal resize event. */
    simulateResize(cols: number, rows: number) {
      capturedOnResize?.({ cols, rows });
    },
  };

  /**
   * Mock Terminal class. Must use `function` keyword (not arrow function)
   * so it can be called with `new` in the component under test. Vitest 4
   * does not allow arrow functions as constructors.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MockTerminal = vi.fn(function Terminal(this: any) {
    Object.assign(this, mockTermInstance);
    return mockTermInstance;
  });

  /** Mock FitAddon instance. */
  const mockFitAddonInstance = {
    fit: vi.fn(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MockFitAddon = vi.fn(function FitAddon(this: any) {
    Object.assign(this, mockFitAddonInstance);
    return mockFitAddonInstance;
  });

  return {
    mockSend: vi.fn(),
    mockOn: vi.fn(),
    mockTermInstance,
    mockFitAddonInstance,
    MockTerminal,
    MockFitAddon,
    ptyCallbacks,
  };
});

// ---------------------------------------------------------------------------
// Mock @xterm/xterm
// ---------------------------------------------------------------------------

vi.mock('@xterm/xterm', () => ({
  Terminal: MockTerminal,
}));

// ---------------------------------------------------------------------------
// Mock @xterm/addon-fit
// ---------------------------------------------------------------------------

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: MockFitAddon,
}));

// ---------------------------------------------------------------------------
// Mock xterm CSS import
// ---------------------------------------------------------------------------

vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

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
// Imports AFTER mocks
// ---------------------------------------------------------------------------

import { TerminalPanel } from '../../renderer/src/components/Terminal/Terminal';

// ---------------------------------------------------------------------------
// Handler capture helper (mirrors editor-workflow pattern)
// ---------------------------------------------------------------------------

/**
 * Captures the WebSocket message handlers registered by the TerminalPanel
 * (via useWebSocket). After rendering, call `simulateMessage` to push data
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
// PTY bridge mock setup
// ---------------------------------------------------------------------------

/**
 * Creates a fresh mock PTY bridge and installs it on `window.paige.terminal`.
 * Captures onData and onExit callbacks for later invocation in tests.
 */
function setupPtyBridge() {
  ptyCallbacks.onData = null;
  ptyCallbacks.onExit = null;

  const mockPtyBridge = {
    write: vi.fn(),
    resize: vi.fn(),
    onData: vi.fn((cb: (data: string) => void) => {
      ptyCallbacks.onData = cb;
    }),
    onExit: vi.fn((cb: (info: { code: number; signal?: number }) => void) => {
      ptyCallbacks.onExit = cb;
    }),
  };

  // Install on window.paige
  (window as Record<string, unknown>).paige = {
    platform: 'linux' as NodeJS.Platform,
    terminal: mockPtyBridge,
  };

  return mockPtyBridge;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Terminal workflow integration', () => {
  let mockPtyBridge: ReturnType<typeof setupPtyBridge>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPtyBridge = setupPtyBridge();
  });

  afterEach(() => {
    // Clean up window.paige to avoid leaking between tests
    delete (window as Record<string, unknown>).paige;
  });

  // -------------------------------------------------------------------------
  // 1. Terminal renders and initializes xterm.js
  // -------------------------------------------------------------------------

  it('renders terminal and initializes xterm instance on mount', () => {
    setupHandlerCapture();
    render(<TerminalPanel />);

    // Verify xterm Terminal was constructed with warm theme options
    expect(MockTerminal).toHaveBeenCalledTimes(1);
    const constructorArgs = MockTerminal.mock.calls[0]![0] as Record<string, unknown>;
    expect(constructorArgs).toHaveProperty('theme');
    expect(constructorArgs).toHaveProperty('fontFamily');
    expect(constructorArgs).toHaveProperty('cursorBlink', true);
    expect(constructorArgs).toHaveProperty('cursorStyle', 'bar');

    // Verify the warm theme has the correct background color
    const theme = constructorArgs.theme as Record<string, unknown>;
    expect(theme.background).toBe('#141413');
    expect(theme.cursor).toBe('#d97757');

    // Verify FitAddon was created and loaded
    expect(MockFitAddon).toHaveBeenCalledTimes(1);
    expect(mockTermInstance.loadAddon).toHaveBeenCalledWith(mockFitAddonInstance);

    // Verify terminal.open() was called with a container element
    expect(mockTermInstance.open).toHaveBeenCalledTimes(1);
    expect(mockTermInstance.open.mock.calls[0]![0]).toBeInstanceOf(HTMLElement);

    // Verify initial fit was called
    expect(mockFitAddonInstance.fit).toHaveBeenCalled();

    // Verify the terminal panel container is in the DOM
    expect(screen.getByTestId('terminal-panel')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 2. Sends terminal:ready WebSocket message on mount
  // -------------------------------------------------------------------------

  it('sends terminal:ready WebSocket message with initial dimensions', () => {
    setupHandlerCapture();
    render(<TerminalPanel />);

    // Verify mockSend was called with terminal:ready and the correct dimensions
    expect(mockSend).toHaveBeenCalledWith('terminal:ready', {
      cols: 80,
      rows: 24,
    });
  });

  // -------------------------------------------------------------------------
  // 3. PTY output renders in terminal
  // -------------------------------------------------------------------------

  it('writes PTY output data to xterm terminal', () => {
    setupHandlerCapture();
    render(<TerminalPanel />);

    // The component should have registered an onData callback with the PTY bridge
    expect(mockPtyBridge.onData).toHaveBeenCalledTimes(1);
    expect(ptyCallbacks.onData).not.toBeNull();

    // Simulate PTY output arriving
    act(() => {
      ptyCallbacks.onData!('$ hello world\r\n');
    });

    // Verify the data was written to the xterm terminal
    expect(mockTermInstance.write).toHaveBeenCalledWith('$ hello world\r\n');
  });

  // -------------------------------------------------------------------------
  // 4. User input forwarded to PTY
  // -------------------------------------------------------------------------

  it('forwards user terminal input to PTY bridge', () => {
    setupHandlerCapture();
    render(<TerminalPanel />);

    // The component should have registered an onData callback with the xterm Terminal
    expect(mockTermInstance.onData).toHaveBeenCalledTimes(1);

    // Simulate user typing in the terminal (xterm captures keypresses and
    // calls the onData callback registered on the Terminal instance)
    act(() => {
      mockTermInstance.simulateUserInput('ls -la\r');
    });

    // Verify the input was forwarded to the PTY bridge
    expect(mockPtyBridge.write).toHaveBeenCalledWith('ls -la\r');
  });

  // -------------------------------------------------------------------------
  // 5. PTY exit shows message
  // -------------------------------------------------------------------------

  it('displays exit message when PTY process exits', () => {
    setupHandlerCapture();
    render(<TerminalPanel />);

    // The component should have registered an onExit callback with the PTY bridge
    expect(mockPtyBridge.onExit).toHaveBeenCalledTimes(1);
    expect(ptyCallbacks.onExit).not.toBeNull();

    // Simulate PTY process exiting with code 0
    act(() => {
      ptyCallbacks.onExit!({ code: 0 });
    });

    // Verify term.writeln was called with an empty line and exit code message
    expect(mockTermInstance.writeln).toHaveBeenCalledWith('');
    expect(mockTermInstance.writeln).toHaveBeenCalledWith(
      expect.stringContaining('Process exited with code 0')
    );

    // Verify exit with signal information
    mockTermInstance.writeln.mockClear();
    act(() => {
      ptyCallbacks.onExit!({ code: 1, signal: 15 });
    });

    expect(mockTermInstance.writeln).toHaveBeenCalledWith(
      expect.stringContaining('Process exited with code 1')
    );
    expect(mockTermInstance.writeln).toHaveBeenCalledWith(expect.stringContaining('signal: 15'));
  });

  // -------------------------------------------------------------------------
  // 6. Observer nudge writes to PTY stdin
  // -------------------------------------------------------------------------

  it('writes observer nudge message to PTY stdin', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<TerminalPanel />);

    // Clear any setup calls to write
    mockPtyBridge.write.mockClear();

    // Simulate an observer:nudge WebSocket message arriving
    simulateMessage('observer:nudge', {
      message: 'echo "Try running the tests"\n',
    });

    // Verify the nudge message was written to the PTY bridge
    expect(mockPtyBridge.write).toHaveBeenCalledWith('echo "Try running the tests"\n');
  });

  // -------------------------------------------------------------------------
  // 7. Fallback message when PTY bridge unavailable
  // -------------------------------------------------------------------------

  it('shows fallback message when PTY bridge is not available', () => {
    setupHandlerCapture();

    // Remove window.paige.terminal to simulate browser context
    delete (window as Record<string, unknown>).paige;

    render(<TerminalPanel />);

    // Verify xterm Terminal was NOT constructed (no PTY bridge = no terminal)
    // The Terminal constructor may still be called, but open should write
    // fallback content to the container instead
    const container = screen.getByTestId('terminal-panel');
    expect(container.textContent).toContain('Terminal unavailable');
    expect(container.textContent).toContain('PTY bridge not found');

    // Verify terminal:ready was NOT sent (no PTY bridge = no ready signal)
    expect(mockSend).not.toHaveBeenCalledWith('terminal:ready', expect.anything());
  });
});
