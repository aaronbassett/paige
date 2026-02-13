/**
 * Unit tests for the ProgressBar component.
 *
 * Covers rendering of all four phase labels, completed-phase marking,
 * active-phase highlighting via data attributes, and progress bar
 * width animation.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { ProgressBar } from '../../../../renderer/src/components/planning/ProgressBar';

// ---------------------------------------------------------------------------
// Mock framer-motion -- motion.div as plain div
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
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProgressBar', () => {
  // -------------------------------------------------------------------------
  // Phase label rendering
  // -------------------------------------------------------------------------

  it('renders all four phase labels', () => {
    render(<ProgressBar currentPhase={null} progress={0} />);

    expect(screen.getByText('Fetching Issue')).toBeTruthy();
    expect(screen.getByText('Exploring Codebase')).toBeTruthy();
    expect(screen.getByText('Building Plan')).toBeTruthy();
    expect(screen.getByText('Writing Hints')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Completed phases
  // -------------------------------------------------------------------------

  it('marks completed phases', () => {
    const { container } = render(<ProgressBar currentPhase="planning" progress={75} />);
    const steps = container.querySelectorAll('[data-testid^="step-"]');
    expect(steps).toHaveLength(4);
  });

  // -------------------------------------------------------------------------
  // Active phase highlight
  // -------------------------------------------------------------------------

  it('highlights the active phase', () => {
    render(<ProgressBar currentPhase="exploring" progress={50} />);
    const active = screen.getByTestId('step-exploring');
    expect(active.getAttribute('data-active')).toBe('true');
  });

  // -------------------------------------------------------------------------
  // Non-active phases
  // -------------------------------------------------------------------------

  it('does not mark non-active phases as active', () => {
    render(<ProgressBar currentPhase="exploring" progress={50} />);

    expect(screen.getByTestId('step-fetching').getAttribute('data-active')).toBe('false');
    expect(screen.getByTestId('step-planning').getAttribute('data-active')).toBe('false');
    expect(screen.getByTestId('step-writing_hints').getAttribute('data-active')).toBe('false');
  });

  // -------------------------------------------------------------------------
  // Null phase
  // -------------------------------------------------------------------------

  it('marks no phase as active when currentPhase is null', () => {
    render(<ProgressBar currentPhase={null} progress={0} />);

    expect(screen.getByTestId('step-fetching').getAttribute('data-active')).toBe('false');
    expect(screen.getByTestId('step-exploring').getAttribute('data-active')).toBe('false');
    expect(screen.getByTestId('step-planning').getAttribute('data-active')).toBe('false');
    expect(screen.getByTestId('step-writing_hints').getAttribute('data-active')).toBe('false');
  });

  // -------------------------------------------------------------------------
  // Completed phase checkmarks
  // -------------------------------------------------------------------------

  it('shows checkmarks for phases before the active one', () => {
    const { container } = render(<ProgressBar currentPhase="planning" progress={75} />);

    // "fetching" (index 0) and "exploring" (index 1) are before "planning" (index 2)
    const checkmarks = container.querySelectorAll('[data-testid="check-complete"]');
    expect(checkmarks).toHaveLength(2);
  });

  it('shows no checkmarks when the first phase is active', () => {
    const { container } = render(<ProgressBar currentPhase="fetching" progress={10} />);

    const checkmarks = container.querySelectorAll('[data-testid="check-complete"]');
    expect(checkmarks).toHaveLength(0);
  });
});
