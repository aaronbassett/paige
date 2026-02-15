/**
 * Unit tests for the HintSlider component.
 *
 * Covers rendering of position labels, active position highlighting,
 * click-to-change behaviour, ASCII progress bar rendering, and
 * accessibility attributes.
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
    it.each([0, 1, 2, 3] as HintLevel[])('highlights the label for level %i', (level) => {
      const onChange = vi.fn();
      render(<HintSlider level={level} onChange={onChange} />);

      const activeLabelEl = screen.getByTestId(`hint-label-${level}`);
      // Active label has fontWeight 600
      expect(activeLabelEl.style.fontWeight).toBe('600');
      // Active label has data-active="true"
      expect(activeLabelEl.getAttribute('data-active')).toBe('true');

      // Inactive labels do not have bold weight
      for (let i = 0; i < LABELS.length; i++) {
        if (i !== level) {
          const inactiveLabel = screen.getByTestId(`hint-label-${i}`);
          expect(inactiveLabel.style.fontWeight).not.toBe('600');
          expect(inactiveLabel.getAttribute('data-active')).toBe('false');
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // Click interaction
  // -------------------------------------------------------------------------

  describe('click interaction', () => {
    it('calls onChange with correct level when a label is clicked', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<HintSlider level={1} onChange={onChange} />);

      const heavyLabel = screen.getByTestId('hint-label-3');
      await user.click(heavyLabel);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(3);
    });

    it('does not call onChange when the already-active label is clicked', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<HintSlider level={0} onChange={onChange} />);

      const noneLabel = screen.getByTestId('hint-label-0');
      await user.click(noneLabel);

      expect(onChange).not.toHaveBeenCalled();
    });

    it('cycles through all levels via label clicks', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      const { rerender } = render(<HintSlider level={0} onChange={onChange} />);

      // Click level 1
      await user.click(screen.getByTestId('hint-label-1'));
      expect(onChange).toHaveBeenLastCalledWith(1);

      // Simulate parent state update
      rerender(<HintSlider level={1} onChange={onChange} />);

      // Click level 2
      await user.click(screen.getByTestId('hint-label-2'));
      expect(onChange).toHaveBeenLastCalledWith(2);

      rerender(<HintSlider level={2} onChange={onChange} />);

      // Click level 3
      await user.click(screen.getByTestId('hint-label-3'));
      expect(onChange).toHaveBeenLastCalledWith(3);

      expect(onChange).toHaveBeenCalledTimes(3);
    });
  });

  // -------------------------------------------------------------------------
  // ASCII progress bar
  // -------------------------------------------------------------------------

  describe('ASCII progress bar', () => {
    it.each([
      [0, '[\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7]'],
      [1, '[=====\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7]'],
      [2, '[=========\u00B7\u00B7\u00B7\u00B7\u00B7]'],
      [3, '[==============]'],
    ] as [HintLevel, string][])('renders correct bar for level %i', (level, expectedBar) => {
      const onChange = vi.fn();
      render(<HintSlider level={level} onChange={onChange} />);

      const bar = screen.getByTestId('hint-bar');
      expect(bar.textContent).toBe(expectedBar);
    });

    it('renders bar as a pre element', () => {
      const onChange = vi.fn();
      render(<HintSlider level={0} onChange={onChange} />);

      const bar = screen.getByTestId('hint-bar');
      expect(bar.tagName).toBe('PRE');
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
  });
});
