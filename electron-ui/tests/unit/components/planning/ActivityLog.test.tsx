/**
 * Unit tests for the ActivityLog component.
 *
 * Covers rendering of log entries, empty state placeholder,
 * optional tool name display, and entry count verification.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { ActivityLog } from '../../../../renderer/src/components/planning/ActivityLog';
import type { LogEntry } from '../../../../renderer/src/hooks/usePlanningProgress';

// ---------------------------------------------------------------------------
// Mock framer-motion -- motion.div as plain div, AnimatePresence passthrough
// ---------------------------------------------------------------------------

vi.mock('framer-motion', () => ({
  motion: {
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
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(
  message: string,
  options?: { toolName?: string; filePath?: string },
): LogEntry {
  return {
    message,
    toolName: options?.toolName,
    filePath: options?.filePath,
    timestamp: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ActivityLog', () => {
  // -------------------------------------------------------------------------
  // Log entry rendering
  // -------------------------------------------------------------------------

  it('renders log entries', () => {
    const logs: LogEntry[] = [
      makeEntry('Reading package.json'),
      makeEntry('Analyzing dependencies'),
    ];

    render(<ActivityLog logs={logs} />);

    expect(screen.getByText('Reading package.json')).toBeTruthy();
    expect(screen.getByText('Analyzing dependencies')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  it('renders empty state when no logs', () => {
    render(<ActivityLog logs={[]} />);

    expect(screen.getByText('Waiting for agent to start...')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Tool name display
  // -------------------------------------------------------------------------

  it('renders tool name when present', () => {
    const logs: LogEntry[] = [
      makeEntry('Opened file for analysis', { toolName: 'read_file' }),
    ];

    render(<ActivityLog logs={logs} />);

    expect(screen.getByText('[read_file]')).toBeTruthy();
    expect(screen.getByText('Opened file for analysis')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Entry count
  // -------------------------------------------------------------------------

  it('caps at rendered entries', () => {
    const logs: LogEntry[] = [
      makeEntry('Step one'),
      makeEntry('Step two'),
      makeEntry('Step three'),
    ];

    render(<ActivityLog logs={logs} />);

    const entries = screen.getAllByTestId('log-entry');
    expect(entries).toHaveLength(3);
  });
});
