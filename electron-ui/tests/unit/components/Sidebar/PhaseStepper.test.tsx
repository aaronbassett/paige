/**
 * Unit tests for the PhaseStepper component.
 *
 * Covers phase indicator rendering (complete/active/pending), hint-level
 * content visibility, accordion behaviour (open/close, single expansion),
 * the onExpandStep callback, and the pulse animation on active phases.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Phase, HintLevel } from '@shared/types/entities';

import { PhaseStepper } from '../../../../renderer/src/components/Sidebar/PhaseStepper';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePhases(overrides?: Partial<Phase>[]): Phase[] {
  const defaults: Phase[] = [
    {
      number: 1,
      title: 'Understand the Problem',
      status: 'complete',
      summary: 'Read the issue and restate the goal.',
    },
    {
      number: 2,
      title: 'Plan Your Approach',
      status: 'active',
      summary: 'Break the problem into smaller steps.',
      steps: [
        {
          title: 'Identify inputs and outputs',
          description: 'List the function parameters and return type.',
        },
        { title: 'Sketch the algorithm', description: 'Write pseudocode or draw a diagram.' },
        {
          title: 'Consider edge cases',
          description: 'Think about empty inputs, nulls, and boundaries.',
        },
      ],
    },
    { number: 3, title: 'Implement', status: 'pending' },
    { number: 4, title: 'Test', status: 'pending' },
    { number: 5, title: 'Refactor', status: 'pending' },
  ];

  if (!overrides) return defaults;

  return defaults.map((phase, i) => ({
    ...phase,
    ...(overrides[i] ?? {}),
  }));
}

function renderStepper(
  hintLevel: HintLevel = 0,
  phases?: Phase[],
  onExpandStep?: PhaseStepperProps['onExpandStep']
) {
  return render(
    <PhaseStepper
      phases={phases ?? makePhases()}
      hintLevel={hintLevel}
      onExpandStep={onExpandStep}
    />
  );
}

// Re-export for type use in renderStepper
import type { PhaseStepperProps } from '../../../../renderer/src/components/Sidebar/PhaseStepper';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PhaseStepper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Phase indicator rendering
  // -------------------------------------------------------------------------

  describe('phase indicators', () => {
    it('renders all five phases with correct indicator types', () => {
      renderStepper(0);

      const completeIndicators = screen.getAllByTestId('indicator-complete');
      const activeIndicators = screen.getAllByTestId('indicator-active');
      const pendingIndicators = screen.getAllByTestId('indicator-pending');

      expect(completeIndicators).toHaveLength(1);
      expect(activeIndicators).toHaveLength(1);
      expect(pendingIndicators).toHaveLength(3);
    });

    it('shows green checkmark for complete phases', () => {
      renderStepper(0);

      const completeIndicator = screen.getByTestId('indicator-complete');
      expect(completeIndicator).toHaveTextContent('\u2713');
      // CSS custom properties are not resolved in happy-dom, so check
      // the raw style property string instead of using toHaveStyle.
      expect(completeIndicator.style.background).toBe('var(--status-success)');
    });

    it('applies pulse animation styling to the active phase indicator', () => {
      renderStepper(0);

      const activeIndicator = screen.getByTestId('indicator-active');
      expect(activeIndicator.style.background).toBe('var(--accent-primary)');
      expect(activeIndicator.style.animation).toContain('pulse-terracotta');
    });

    it('renders pending phases as outlined circles', () => {
      renderStepper(0);

      const pendingIndicators = screen.getAllByTestId('indicator-pending');
      pendingIndicators.forEach((indicator) => {
        expect(indicator.style.background).toBe('transparent');
        // happy-dom splits border shorthand; check that the border
        // style attribute string contains the expected values.
        const borderAttr = indicator.getAttribute('style') ?? '';
        expect(borderAttr).toContain('border:');
        expect(borderAttr).toContain('2px');
        expect(borderAttr).toContain('solid');
        expect(borderAttr).toContain('var(--text-muted)');
      });
    });

    it('renders connecting lines between phases (not after the last)', () => {
      renderStepper(0);

      const lines = screen.getAllByTestId('connecting-line');
      // 5 phases, 4 connecting lines
      expect(lines).toHaveLength(4);
    });
  });

  // -------------------------------------------------------------------------
  // Hint level 0: title only
  // -------------------------------------------------------------------------

  describe('hint level 0 -- title only', () => {
    it('shows all phase titles', () => {
      renderStepper(0);

      expect(screen.getByText('Understand the Problem')).toBeInTheDocument();
      expect(screen.getByText('Plan Your Approach')).toBeInTheDocument();
      expect(screen.getByText('Implement')).toBeInTheDocument();
      expect(screen.getByText('Test')).toBeInTheDocument();
      expect(screen.getByText('Refactor')).toBeInTheDocument();
    });

    it('does not show summary text', () => {
      renderStepper(0);

      expect(screen.queryByText('Break the problem into smaller steps.')).not.toBeInTheDocument();
    });

    it('does not show sub-step titles', () => {
      renderStepper(0);

      expect(screen.queryByText('Identify inputs and outputs')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Hint level 1: title + summary
  // -------------------------------------------------------------------------

  describe('hint level 1 -- title + summary', () => {
    it('shows summary for the active phase', () => {
      renderStepper(1);

      expect(screen.getByText('Break the problem into smaller steps.')).toBeInTheDocument();
    });

    it('does not show summary for non-active phases', () => {
      renderStepper(1);

      // Phase 1 is complete and has a summary, but it should not be shown
      expect(screen.queryByText('Read the issue and restate the goal.')).not.toBeInTheDocument();
    });

    it('does not show sub-step titles', () => {
      renderStepper(1);

      expect(screen.queryByText('Identify inputs and outputs')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Hint level 2: title + summary + sub-step titles
  // -------------------------------------------------------------------------

  describe('hint level 2 -- title + summary + sub-step titles', () => {
    it('shows sub-step titles for the active phase', () => {
      renderStepper(2);

      expect(screen.getByText('Identify inputs and outputs')).toBeInTheDocument();
      expect(screen.getByText('Sketch the algorithm')).toBeInTheDocument();
      expect(screen.getByText('Consider edge cases')).toBeInTheDocument();
    });

    it('shows sub-step titles as plain text (not buttons)', () => {
      renderStepper(2);

      // At level 2, steps are <p> tags not <button> tags
      expect(screen.queryByRole('button', { name: /Identify inputs/ })).not.toBeInTheDocument();
    });

    it('does not show sub-step descriptions', () => {
      renderStepper(2);

      expect(
        screen.queryByText('List the function parameters and return type.')
      ).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Hint level 3: accordion
  // -------------------------------------------------------------------------

  describe('hint level 3 -- accordion', () => {
    it('renders sub-steps as expandable buttons', () => {
      renderStepper(3);

      const stepButtons = screen.getAllByRole('button');
      expect(stepButtons).toHaveLength(3);
      expect(stepButtons[0]).toHaveAttribute('aria-expanded', 'false');
    });

    it('expands a step when clicked, showing its description', async () => {
      const user = userEvent.setup();
      renderStepper(3);

      const stepButton = screen.getByRole('button', { name: /Identify inputs/ });
      await user.click(stepButton);

      expect(stepButton).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('List the function parameters and return type.')).toBeInTheDocument();
    });

    it('collapses a step when clicked again', async () => {
      const user = userEvent.setup();
      renderStepper(3);

      const stepButton = screen.getByRole('button', { name: /Identify inputs/ });

      // Open
      await user.click(stepButton);
      expect(screen.getByText('List the function parameters and return type.')).toBeInTheDocument();

      // Close
      await user.click(stepButton);
      expect(
        screen.queryByText('List the function parameters and return type.')
      ).not.toBeInTheDocument();
      expect(stepButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('allows only one step to be expanded at a time', async () => {
      const user = userEvent.setup();
      renderStepper(3);

      const firstStep = screen.getByRole('button', { name: /Identify inputs/ });
      const secondStep = screen.getByRole('button', { name: /Sketch the algorithm/ });

      // Open first step
      await user.click(firstStep);
      expect(firstStep).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('List the function parameters and return type.')).toBeInTheDocument();

      // Open second step -- first should close
      await user.click(secondStep);
      expect(secondStep).toHaveAttribute('aria-expanded', 'true');
      expect(firstStep).toHaveAttribute('aria-expanded', 'false');
      expect(
        screen.queryByText('List the function parameters and return type.')
      ).not.toBeInTheDocument();
      expect(screen.getByText('Write pseudocode or draw a diagram.')).toBeInTheDocument();
    });

    it('calls onExpandStep when a step is expanded', async () => {
      const user = userEvent.setup();
      const onExpandStep = vi.fn();
      renderStepper(3, undefined, onExpandStep);

      const secondStep = screen.getByRole('button', { name: /Sketch the algorithm/ });
      await user.click(secondStep);

      expect(onExpandStep).toHaveBeenCalledTimes(1);
      expect(onExpandStep).toHaveBeenCalledWith(2, 1);
    });

    it('does not call onExpandStep when collapsing a step', async () => {
      const user = userEvent.setup();
      const onExpandStep = vi.fn();
      renderStepper(3, undefined, onExpandStep);

      const firstStep = screen.getByRole('button', { name: /Identify inputs/ });

      // Expand (triggers callback)
      await user.click(firstStep);
      expect(onExpandStep).toHaveBeenCalledTimes(1);

      // Collapse (should NOT trigger callback again)
      await user.click(firstStep);
      expect(onExpandStep).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Active phase styling
  // -------------------------------------------------------------------------

  describe('active phase styling', () => {
    it('renders the active phase title in bold', () => {
      renderStepper(0);

      const activePhase = screen.getByTestId('phase-2');
      const title = within(activePhase).getByText('Plan Your Approach');
      expect(title).toHaveStyle({ fontWeight: 700 });
    });

    it('renders non-active phase titles without bold', () => {
      renderStepper(0);

      const pendingPhase = screen.getByTestId('phase-3');
      const title = within(pendingPhase).getByText('Implement');
      // Default fontWeight is not 700 (no explicit fontWeight set)
      expect(title.style.fontWeight).not.toBe('700');
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles phases with no summary gracefully at hint level 1', () => {
      const phases = makePhases([{}, { summary: undefined }, {}, {}, {}]);
      renderStepper(1, phases);

      // Should not throw, titles still render
      expect(screen.getByText('Plan Your Approach')).toBeInTheDocument();
    });

    it('handles phases with no steps gracefully at hint level 2', () => {
      const phases = makePhases([{}, { steps: undefined }, {}, {}, {}]);
      renderStepper(2, phases);

      expect(screen.getByText('Plan Your Approach')).toBeInTheDocument();
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('handles empty phases array', () => {
      const { container } = renderStepper(0, []);

      const nav = container.querySelector('nav');
      expect(nav).toBeInTheDocument();
      expect(nav?.children).toHaveLength(0);
    });

    it('renders accessible nav landmark', () => {
      renderStepper(0);

      expect(screen.getByRole('navigation', { name: 'Coaching phases' })).toBeInTheDocument();
    });
  });
});
