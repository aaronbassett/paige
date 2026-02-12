/**
 * Unit tests for the CollapsedIcon component.
 *
 * Covers rendering, click interaction, sizing, animation style,
 * keyboard accessibility, and type-based color mapping.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { CollapsedIcon } from '../../../../renderer/src/components/Hints/CollapsedIcon';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@floating-ui/react', () => ({
  useFloating: () => ({
    refs: { setReference: vi.fn(), setFloating: vi.fn() },
    floatingStyles: { position: 'absolute' as const, top: 0, left: 0 },
    context: { refs: { setReference: vi.fn(), setFloating: vi.fn() }, elements: {} },
  }),
  offset: () => ({}),
  flip: () => ({}),
  shift: () => ({}),
  autoUpdate: vi.fn(() => vi.fn()),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_PROPS = {
  messageId: 'msg-123',
  type: 'hint' as const,
  referenceElement: null,
  onExpand: vi.fn(),
};

function renderIcon(overrides?: Partial<typeof DEFAULT_PROPS>) {
  return render(<CollapsedIcon {...DEFAULT_PROPS} {...overrides} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CollapsedIcon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  describe('rendering', () => {
    it('renders the speech bubble SVG icon', () => {
      renderIcon();

      const svg = screen.getByTestId('collapsed-icon-svg');
      expect(svg).toBeInTheDocument();
      expect(svg.tagName.toLowerCase()).toBe('svg');

      // Verify the speech bubble path exists
      const path = svg.querySelector('path');
      expect(path).not.toBeNull();
      expect(path?.getAttribute('fill')).toBe('white');
    });

    it('renders with correct data-message-id attribute', () => {
      renderIcon({ messageId: 'msg-456' });

      const icon = screen.getByTestId('collapsed-icon');
      expect(icon.getAttribute('data-message-id')).toBe('msg-456');
    });

    it('has role="button" and is focusable', () => {
      renderIcon();

      const icon = screen.getByRole('button', { name: /expand hint message/i });
      expect(icon).toBeInTheDocument();
      expect(icon.getAttribute('tabindex')).toBe('0');
    });

    it('has appropriate aria-label based on type', () => {
      renderIcon({ type: 'warning' });

      const icon = screen.getByRole('button', { name: /expand warning message/i });
      expect(icon).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Click interaction
  // -------------------------------------------------------------------------

  describe('click interaction', () => {
    it('calls onExpand with messageId on click', () => {
      const onExpand = vi.fn();
      renderIcon({ messageId: 'msg-789', onExpand });

      const icon = screen.getByTestId('collapsed-icon');
      fireEvent.click(icon);

      expect(onExpand).toHaveBeenCalledTimes(1);
      expect(onExpand).toHaveBeenCalledWith('msg-789');
    });

    it('calls onExpand with messageId on Enter key', () => {
      const onExpand = vi.fn();
      renderIcon({ messageId: 'msg-enter', onExpand });

      const icon = screen.getByTestId('collapsed-icon');
      fireEvent.keyDown(icon, { key: 'Enter' });

      expect(onExpand).toHaveBeenCalledTimes(1);
      expect(onExpand).toHaveBeenCalledWith('msg-enter');
    });

    it('calls onExpand with messageId on Space key', () => {
      const onExpand = vi.fn();
      renderIcon({ messageId: 'msg-space', onExpand });

      const icon = screen.getByTestId('collapsed-icon');
      fireEvent.keyDown(icon, { key: ' ' });

      expect(onExpand).toHaveBeenCalledTimes(1);
      expect(onExpand).toHaveBeenCalledWith('msg-space');
    });

    it('does not call onExpand on other keys', () => {
      const onExpand = vi.fn();
      renderIcon({ onExpand });

      const icon = screen.getByTestId('collapsed-icon');
      fireEvent.keyDown(icon, { key: 'Escape' });

      expect(onExpand).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Size and shape
  // -------------------------------------------------------------------------

  describe('size and shape', () => {
    it('has correct size (20px circle)', () => {
      renderIcon();

      const icon = screen.getByTestId('collapsed-icon');
      expect(icon.style.width).toBe('20px');
      expect(icon.style.height).toBe('20px');
      expect(icon.style.borderRadius).toBe('50%');
    });

    it('has cursor pointer', () => {
      renderIcon();

      const icon = screen.getByTestId('collapsed-icon');
      expect(icon.style.cursor).toBe('pointer');
    });
  });

  // -------------------------------------------------------------------------
  // Pulse animation
  // -------------------------------------------------------------------------

  describe('pulse animation', () => {
    it('has pulse animation style', () => {
      renderIcon();

      const icon = screen.getByTestId('collapsed-icon');
      expect(icon.style.animation).toContain('collapsed-icon-pulse');
      expect(icon.style.animation).toContain('2s');
      expect(icon.style.animation).toContain('infinite');
    });
  });

  // -------------------------------------------------------------------------
  // Type-based colors
  // -------------------------------------------------------------------------

  describe('type-based colors', () => {
    it('uses terracotta for hint type', () => {
      renderIcon({ type: 'hint' });

      const icon = screen.getByTestId('collapsed-icon');
      expect(icon.style.background).toContain('217');
      expect(icon.style.background).toContain('119');
      expect(icon.style.background).toContain('87');
    });

    it('uses blue for info type', () => {
      renderIcon({ type: 'info' });

      const icon = screen.getByTestId('collapsed-icon');
      expect(icon.style.background).toContain('107');
      expect(icon.style.background).toContain('159');
      expect(icon.style.background).toContain('204');
    });

    it('uses green for success type', () => {
      renderIcon({ type: 'success' });

      const icon = screen.getByTestId('collapsed-icon');
      expect(icon.style.background).toContain('122');
      expect(icon.style.background).toContain('184');
      expect(icon.style.background).toContain('143');
    });

    it('uses amber for warning type', () => {
      renderIcon({ type: 'warning' });

      const icon = screen.getByTestId('collapsed-icon');
      expect(icon.style.background).toContain('212');
      expect(icon.style.background).toContain('168');
      expect(icon.style.background).toContain('87');
    });
  });
});
