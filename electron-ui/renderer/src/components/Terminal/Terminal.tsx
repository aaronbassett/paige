/**
 * TerminalPanel — xterm.js terminal connected to a PTY via IPC bridge.
 *
 * Renders a full-size xterm.js terminal with a warm ANSI color theme
 * matching the Paige design system. Communicates with the Electron main
 * process PTY through `window.paige.terminal`, and notifies the backend
 * via WebSocket when the terminal is ready.
 *
 * Lifecycle:
 *  1. Mount: create Terminal + FitAddon, open in container div
 *  2. Connect PTY data listeners (bidirectional)
 *  3. Send `terminal:ready` WebSocket message with initial dimensions
 *  4. Listen for container resize via ResizeObserver, refit on change
 *  5. Unmount: dispose terminal, disconnect listeners
 */

import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { ITheme } from '@xterm/xterm';
import { useWebSocket } from '../../hooks/useWebSocket';

// ---------------------------------------------------------------------------
// Warm ANSI Theme
// ---------------------------------------------------------------------------
// Maps all 16 ANSI colors to warm variants that complement the Paige design
// system. No cold blues — violet replaces blue throughout.

const WARM_THEME: ITheme = {
  background: '#141413', // --bg-inset
  foreground: '#faf9f5', // --text-primary
  cursor: '#d97757', // --accent-primary (terracotta)
  cursorAccent: '#141413',
  selectionBackground: 'rgba(217, 119, 87, 0.3)', // terracotta 30%
  selectionForeground: '#faf9f5',

  // Standard colors (warm palette)
  black: '#1a1a18', // warm black
  red: '#e05252', // warm red
  green: '#7cb87c', // warm green
  yellow: '#d4a843', // warm gold
  blue: '#8b7ec8', // warm violet (not cold blue)
  magenta: '#c77dba', // warm magenta
  cyan: '#6ba3a0', // warm teal
  white: '#a8a69e', // warm grey

  // Bright colors
  brightBlack: '#6b6960', // warm grey
  brightRed: '#ff6b6b', // bright warm red
  brightGreen: '#95d695', // bright warm green
  brightYellow: '#f0c674', // bright warm gold
  brightBlue: '#a594e0', // bright warm violet
  brightMagenta: '#e098d3', // bright warm magenta
  brightCyan: '#85c4c1', // bright warm teal
  brightWhite: '#faf9f5', // parchment white
};

// ---------------------------------------------------------------------------
// Terminal Options
// ---------------------------------------------------------------------------

const TERMINAL_OPTIONS = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 14,
  lineHeight: 1.2,
  cursorBlink: true,
  cursorStyle: 'bar' as const,
  scrollback: 5000,
  theme: WARM_THEME,
  allowProposedApi: true,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TerminalPanelProps {
  cwd?: string;
}

/**
 * Terminal panel that renders an xterm.js instance connected to a PTY
 * running in the Electron main process.
 *
 * Falls back to a styled message when the PTY bridge is not available
 * (e.g. running in a browser context without Electron).
 */
export function TerminalPanel({ cwd }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { send, on } = useWebSocket();
  const ptySpawnedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check PTY bridge availability
    const ptyBridge = window.paige?.terminal;
    if (!ptyBridge) {
      container.innerHTML =
        '<div style="padding: 16px; color: #a8a69e; font-family: \'JetBrains Mono\', monospace; font-size: 14px;">' +
        'Terminal unavailable: PTY bridge not found.' +
        '</div>';
      return;
    }

    // Create xterm instance and fit addon
    const term = new Terminal(TERMINAL_OPTIONS);
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);

    // Initial fit (must happen after open)
    fitAddon.fit();

    // -----------------------------------------------------------------------
    // Bidirectional PTY connection
    // -----------------------------------------------------------------------

    // PTY output -> xterm display
    ptyBridge.onData((data: string) => {
      term.write(data);
    });

    // User input -> PTY
    const userDataDisposable = term.onData((data: string) => {
      ptyBridge.write(data);
    });

    // PTY exit -> display exit message
    ptyBridge.onExit((info: { code: number; signal?: number }) => {
      const signal = info.signal != null ? ` (signal: ${info.signal})` : '';
      term.writeln('');
      term.writeln(`\x1b[33m-- Process exited with code ${info.code}${signal} --\x1b[0m`);
    });

    // -----------------------------------------------------------------------
    // Notify backend that terminal is ready
    // -----------------------------------------------------------------------

    void send('terminal:ready', {
      cols: term.cols,
      rows: term.rows,
    });

    // -----------------------------------------------------------------------
    // Resize handling
    // -----------------------------------------------------------------------

    // Sync PTY dimensions when terminal resizes (handled locally by Electron PTY)
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      ptyBridge.resize(cols, rows);
      // Note: Backend doesn't need to know about terminal resize (PTY is local)
    });

    // Observe container size changes and refit
    const resizeObserver = new ResizeObserver(() => {
      // requestAnimationFrame prevents layout thrashing during resize
      requestAnimationFrame(() => {
        fitAddon.fit();
      });
    });
    resizeObserver.observe(container);

    // -----------------------------------------------------------------------
    // Observer nudges: backend sends text to write into PTY stdin
    // -----------------------------------------------------------------------

    const unsubNudge = on('observer:nudge', (msg) => {
      const payload = msg.payload as { message: string };
      if (payload.message) {
        ptyBridge.write(payload.message);
      }
    });

    // -----------------------------------------------------------------------
    // Cleanup
    // -----------------------------------------------------------------------

    return () => {
      unsubNudge();
      resizeObserver.disconnect();
      resizeDisposable.dispose();
      userDataDisposable.dispose();
      term.dispose();
    };
  }, [send, on]);

  // Spawn PTY when cwd prop becomes available (from planning:complete)
  useEffect(() => {
    const ptyBridge = window.paige?.terminal;
    if (!ptyBridge || !cwd || ptySpawnedRef.current) return;
    ptyBridge.spawn(cwd);
    ptySpawnedRef.current = true;
  }, [cwd]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
      data-testid="terminal-panel"
      role="region"
      aria-label="Terminal"
    />
  );
}
