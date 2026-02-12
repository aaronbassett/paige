/**
 * Unit tests for the HintSlider component.
 *
 * Covers rendering of position labels, active position highlighting,
 * click-to-change behaviour, emoji illustration per level, and
 * slider indicator positioning.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import type { HintLevel } from '@shared/types/entities';
import { HintSlider } from '../../../../renderer/src/components/Sidebar/HintSlider';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LABELS = ['None', 'Light', 'Medium', 'Heavy'] as const;

const LEVEL_EMOJIS: Record<HintLevel, string> = {
  0: '\uD83D\uDCBB', // laptop
  1: '\uD83D\uDCDA', // books
  2: '\uD83D\uDC49', // pointing
  3: '\uD83C\uDF79', // cocktail
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HintSlider', () => {
  // -------------------------------------------------------------------------
  // Label rendering
  // -------------------------------------------------------------------------

  describe('label rendering', () => {
    it('renders all 4 position labels', () => {
      const onChange = vi.fn();
      render(<HintSlider level={0} onChange={onChange} />);

      for (const label of LABELS) {
        expect(screen.getByTestId(`hint-label-${LABELS.indexOf(label)}`)).toHaveTextContent(label);
      }
    });

    it('renders labels as clickable elements', () => {
      const onChange = vi.fn();
      render(<HintSlider level={0} onChange={onChange} />);

      for (let i = 0; i < LABELS.length; i++) {
        const labelEl = screen.getByTestId(`hint-label-${i}`);
        expect(labelEl.getAttribute('role')).toBe('button');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Active position highlighting
  // -------------------------------------------------------------------------

  describe('active position highlighting', () => {
    it.each([0, 1, 2, 3] as HintLevel[])('highlights level %i dot as active', (level) => {
      const onChange = vi.fn();
      render(<HintSlider level={level} onChange={onChange} />);

      // The active dot should have data-active="true"
      const activeDot = screen.getByLabelText(`Set hint level to ${LABELS[level]}`);
      expect(activeDot.getAttribute('data-active')).toBe('true');

      // Other dots should have data-active="false"
      for (let i = 0; i < LABELS.length; i++) {
        if (i !== level) {
          const dot = screen.getByLabelText(`Set hint level to ${LABELS[i]}`);
          expect(dot.getAttribute('data-active')).toBe('false');
        }
      }
    });

    it.each([0, 1, 2, 3] as HintLevel[])('highlights the label for level %i', (level) => {
      const onChange = vi.fn();
      render(<HintSlider level={level} onChange={onChange} />);

      const activeLabelEl = screen.getByTestId(`hint-label-${level}`);
      // Active label has fontWeight 600
      expect(activeLabelEl.style.fontWeight).toBe('600');

      // Inactive labels do not have bold weight
      for (let i = 0; i < LABELS.length; i++) {
        if (i !== level) {
          const inactiveLabel = screen.getByTestId(`hint-label-${i}`);
          expect(inactiveLabel.style.fontWeight).not.toBe('600');
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // Click interaction
  // -------------------------------------------------------------------------

  describe('click interaction', () => {
    it('calls onChange with correct level when a dot is clicked', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<HintSlider level={0} onChange={onChange} />);

      const mediumDot = screen.getByLabelText('Set hint level to Medium');
      await user.click(mediumDot);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(2);
    });

    it('calls onChange with correct level when a label is clicked', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<HintSlider level={1} onChange={onChange} />);

      const heavyLabel = screen.getByTestId('hint-label-3');
      await user.click(heavyLabel);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(3);
    });

    it('does not call onChange when the already-active dot is clicked', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<HintSlider level={2} onChange={onChange} />);

      const currentDot = screen.getByLabelText('Set hint level to Medium');
      await user.click(currentDot);

      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not call onChange when the already-active label is clicked', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<HintSlider level={0} onChange={onChange} />);

      const noneLabel = screen.getByTestId('hint-label-0');
      await user.click(noneLabel);

      expect(onChange).not.toHaveBeenCalled();
    });

    it('cycles through all levels via dot clicks', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      const { rerender } = render(<HintSlider level={0} onChange={onChange} />);

      // Click level 1
      await user.click(screen.getByLabelText('Set hint level to Light'));
      expect(onChange).toHaveBeenLastCalledWith(1);

      // Simulate parent state update
      rerender(<HintSlider level={1} onChange={onChange} />);

      // Click level 2
      await user.click(screen.getByLabelText('Set hint level to Medium'));
      expect(onChange).toHaveBeenLastCalledWith(2);

      rerender(<HintSlider level={2} onChange={onChange} />);

      // Click level 3
      await user.click(screen.getByLabelText('Set hint level to Heavy'));
      expect(onChange).toHaveBeenLastCalledWith(3);

      expect(onChange).toHaveBeenCalledTimes(3);
    });
  });

  // -------------------------------------------------------------------------
  // Emoji illustration
  // -------------------------------------------------------------------------

  describe('emoji illustration', () => {
    it.each([0, 1, 2, 3] as HintLevel[])('shows correct emoji for level %i', (level) => {
      const onChange = vi.fn();
      render(<HintSlider level={level} onChange={onChange} />);

      const illustration = screen.getByTestId('hint-illustration');
      expect(illustration.textContent).toBe(LEVEL_EMOJIS[level]);
    });

    it('updates emoji when level changes', () => {
      const onChange = vi.fn();
      const { rerender } = render(<HintSlider level={0} onChange={onChange} />);

      expect(screen.getByTestId('hint-illustration').textContent).toBe(LEVEL_EMOJIS[0]);

      rerender(<HintSlider level={3} onChange={onChange} />);

      expect(screen.getByTestId('hint-illustration').textContent).toBe(LEVEL_EMOJIS[3]);
    });
  });

  // -------------------------------------------------------------------------
  // Slider indicator position
  // -------------------------------------------------------------------------

  describe('slider indicator', () => {
    it.each([
      [0, '0%'],
      [1, '33.333%'],
      [2, '66.666%'],
      [3, '100%'],
    ] as [HintLevel, string][])('indicator has width %s at level %i', (level, expectedWidth) => {
      const onChange = vi.fn();
      render(<HintSlider level={level} onChange={onChange} />);

      const indicator = screen.getByTestId('slider-indicator');
      expect(indicator.style.width).toBe(expectedWidth);
    });

    it('indicator has CSS transition for smooth movement', () => {
      const onChange = vi.fn();
      render(<HintSlider level={0} onChange={onChange} />);

      const indicator = screen.getByTestId('slider-indicator');
      expect(indicator.style.transition).toContain('width');
      expect(indicator.style.transition).toContain('0.3s');
    });
  });

  // -------------------------------------------------------------------------
  // Accessibility
  // -------------------------------------------------------------------------

  describe('accessibility', () => {
    it('has a group with accessible label', () => {
      const onChange = vi.fn();
      render(<HintSlider level={0} onChange={onChange} />);

      expect(screen.getByRole('group', { name: 'Hint level selector' })).toBeInTheDocument();
    });

    it('has a slider role with correct aria values', () => {
      const onChange = vi.fn();
      render(<HintSlider level={2} onChange={onChange} />);

      const slider = screen.getByRole('slider', { name: 'Hint level' });
      expect(slider.getAttribute('aria-valuemin')).toBe('0');
      expect(slider.getAttribute('aria-valuemax')).toBe('3');
      expect(slider.getAttribute('aria-valuenow')).toBe('2');
      expect(slider.getAttribute('aria-valuetext')).toContain('Medium');
    });

    it('announces level description via aria-live', () => {
      const onChange = vi.fn();
      render(<HintSlider level={1} onChange={onChange} />);

      const description = screen.getByText('Subtle nudges only');
      expect(description.getAttribute('aria-live')).toBe('polite');
    });

    it('each dot has descriptive aria-label', () => {
      const onChange = vi.fn();
      render(<HintSlider level={0} onChange={onChange} />);

      for (const label of LABELS) {
        expect(screen.getByLabelText(`Set hint level to ${label}`)).toBeInTheDocument();
      }
    });
  });
});
