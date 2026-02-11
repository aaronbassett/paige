/**
 * Unit tests for the HintIllustration component.
 *
 * Covers rendering of SVG img tags for each hint level, emoji fallback
 * when images fail to load, correct container height, accessible labels,
 * and level transitions.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HintIllustration } from '../../../../renderer/src/components/Sidebar/HintIllustration';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HintIllustration', () => {
  // -------------------------------------------------------------------------
  // Rendering — img tag
  // -------------------------------------------------------------------------

  describe('rendering', () => {
    it('renders an img tag for level 0 with an SVG src', () => {
      render(<HintIllustration level={0} />);

      const img = screen.getByTestId('hint-illustration-img');
      expect(img).toBeInTheDocument();
      expect(img.tagName).toBe('IMG');
      // Vite may inline SVGs as data: URIs or serve as file paths
      const src = img.getAttribute('src') ?? '';
      expect(src.length).toBeGreaterThan(0);
      expect(src).toMatch(/svg/i);
    });

    it('renders an img tag for level 1 with an SVG src', () => {
      render(<HintIllustration level={1} />);

      const img = screen.getByTestId('hint-illustration-img');
      expect(img).toBeInTheDocument();
      const src = img.getAttribute('src') ?? '';
      expect(src.length).toBeGreaterThan(0);
      expect(src).toMatch(/svg/i);
    });

    it('renders an img tag for level 2 with an SVG src', () => {
      render(<HintIllustration level={2} />);

      const img = screen.getByTestId('hint-illustration-img');
      expect(img).toBeInTheDocument();
      const src = img.getAttribute('src') ?? '';
      expect(src.length).toBeGreaterThan(0);
      expect(src).toMatch(/svg/i);
    });

    it('renders an img tag for level 3 with an SVG src', () => {
      render(<HintIllustration level={3} />);

      const img = screen.getByTestId('hint-illustration-img');
      expect(img).toBeInTheDocument();
      const src = img.getAttribute('src') ?? '';
      expect(src.length).toBeGreaterThan(0);
      expect(src).toMatch(/svg/i);
    });

    it('renders a different src for each level', () => {
      const sources = new Set<string>();

      for (const level of [0, 1, 2, 3] as const) {
        const { unmount } = render(<HintIllustration level={level} />);
        const img = screen.getByTestId('hint-illustration-img');
        sources.add(img.getAttribute('src') ?? '');
        unmount();
      }

      expect(sources.size).toBe(4);
    });
  });

  // -------------------------------------------------------------------------
  // Emoji fallback
  // -------------------------------------------------------------------------

  describe('emoji fallback', () => {
    it('shows laptop emoji when level 0 img fails to load', () => {
      render(<HintIllustration level={0} />);

      const img = screen.getByTestId('hint-illustration-img');
      fireEvent.error(img);

      const emoji = screen.getByTestId('hint-emoji-fallback');
      expect(emoji).toBeInTheDocument();
      expect(emoji.textContent).toBe('\u{1F4BB}');
    });

    it('shows books emoji when level 1 img fails to load', () => {
      render(<HintIllustration level={1} />);

      const img = screen.getByTestId('hint-illustration-img');
      fireEvent.error(img);

      const emoji = screen.getByTestId('hint-emoji-fallback');
      expect(emoji.textContent).toBe('\u{1F4DA}');
    });

    it('shows pointing emoji when level 2 img fails to load', () => {
      render(<HintIllustration level={2} />);

      const img = screen.getByTestId('hint-illustration-img');
      fireEvent.error(img);

      const emoji = screen.getByTestId('hint-emoji-fallback');
      expect(emoji.textContent).toBe('\u{1F449}');
    });

    it('shows cocktail emoji when level 3 img fails to load', () => {
      render(<HintIllustration level={3} />);

      const img = screen.getByTestId('hint-illustration-img');
      fireEvent.error(img);

      const emoji = screen.getByTestId('hint-emoji-fallback');
      expect(emoji.textContent).toBe('\u{1F379}');
    });

    it('does not show img after fallback is triggered', () => {
      render(<HintIllustration level={0} />);

      const img = screen.getByTestId('hint-illustration-img');
      fireEvent.error(img);

      expect(screen.queryByTestId('hint-illustration-img')).not.toBeInTheDocument();
      expect(screen.getByTestId('hint-emoji-fallback')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Container height
  // -------------------------------------------------------------------------

  describe('container height', () => {
    it('renders with a fixed height of 80px', () => {
      render(<HintIllustration level={0} />);

      const container = screen.getByTestId('hint-illustration');
      expect(container.style.height).toBe('80px');
    });

    it('centers content within the container', () => {
      render(<HintIllustration level={0} />);

      const container = screen.getByTestId('hint-illustration');
      expect(container.style.display).toBe('flex');
      expect(container.style.alignItems).toBe('center');
      expect(container.style.justifyContent).toBe('center');
    });
  });

  // -------------------------------------------------------------------------
  // Accessibility
  // -------------------------------------------------------------------------

  describe('accessibility', () => {
    it('has role="img" on the container', () => {
      render(<HintIllustration level={0} />);

      const container = screen.getByRole('img');
      expect(container).toBeInTheDocument();
    });

    it('includes hint level in aria-label', () => {
      render(<HintIllustration level={2} />);

      const container = screen.getByRole('img');
      expect(container.getAttribute('aria-label')).toContain('Hint level 2');
      expect(container.getAttribute('aria-label')).toContain('Active guidance');
    });

    it('sets alt="" on the img to avoid redundant announcement', () => {
      render(<HintIllustration level={0} />);

      const img = screen.getByTestId('hint-illustration-img');
      expect(img.getAttribute('alt')).toBe('');
    });
  });
});
