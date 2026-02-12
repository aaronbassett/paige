/**
 * Unit tests for the IssueContextDisplay component.
 *
 * Covers rendering of issue number link, title truncation, label pills
 * with auto-contrast colors, AI summary toggle, and null-state handling.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IssueContext } from '@shared/types/entities';
import {
  IssueContextDisplay,
  getContrastColor,
} from '../../../../renderer/src/components/Sidebar/IssueContext';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIssueContext(overrides?: Partial<IssueContext>): IssueContext {
  return {
    number: 42,
    title: 'Fix the login flow for OAuth providers',
    summary: 'The OAuth callback handler is not processing the state parameter correctly.',
    labels: [
      { name: 'bug', color: '#d73a4a' },
      { name: 'auth', color: '#0e8a16' },
    ],
    url: 'https://github.com/org/repo/issues/42',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IssueContextDisplay', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Null state
  // -------------------------------------------------------------------------

  describe('null state', () => {
    it('returns null when issueContext is null', () => {
      const { container } = render(<IssueContextDisplay issueContext={null} />);
      expect(container.firstChild).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Issue number link
  // -------------------------------------------------------------------------

  describe('issue number link', () => {
    it('renders issue number as a clickable link with #N format', () => {
      const issue = makeIssueContext();
      render(<IssueContextDisplay issueContext={issue} />);

      const link = screen.getByRole('link', { name: 'Issue #42' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveTextContent('#42');
      expect(link).toHaveAttribute('href', 'https://github.com/org/repo/issues/42');
    });

    it('opens the issue URL in a new window on click', async () => {
      const issue = makeIssueContext();
      const windowOpenSpy = vi.fn();
      vi.stubGlobal('open', windowOpenSpy);

      const user = userEvent.setup();
      render(<IssueContextDisplay issueContext={issue} />);

      const link = screen.getByRole('link', { name: 'Issue #42' });
      await user.click(link);

      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://github.com/org/repo/issues/42',
        '_blank',
        'noopener,noreferrer'
      );

      vi.unstubAllGlobals();
    });
  });

  // -------------------------------------------------------------------------
  // Title rendering
  // -------------------------------------------------------------------------

  describe('title', () => {
    it('renders the title as an h3 heading', () => {
      const issue = makeIssueContext();
      render(<IssueContextDisplay issueContext={issue} />);

      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveTextContent('Fix the login flow for OAuth providers');
    });

    it('applies CSS line-clamp for truncation', () => {
      const issue = makeIssueContext();
      render(<IssueContextDisplay issueContext={issue} />);

      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading.style.WebkitLineClamp).toBe('2');
      expect(heading.style.overflow).toBe('hidden');
    });
  });

  // -------------------------------------------------------------------------
  // Label pills
  // -------------------------------------------------------------------------

  describe('label pills', () => {
    it('renders label pills with correct background colors', () => {
      const issue = makeIssueContext();
      render(<IssueContextDisplay issueContext={issue} />);

      const bugPill = screen.getByText('bug');
      expect(bugPill).toBeInTheDocument();
      expect(bugPill.style.backgroundColor).toBe('#d73a4a');

      const authPill = screen.getByText('auth');
      expect(authPill).toBeInTheDocument();
      expect(authPill.style.backgroundColor).toBe('#0e8a16');
    });

    it('renders correct text color based on background luminance', () => {
      const issue = makeIssueContext({
        labels: [
          { name: 'dark-bg', color: '#000000' },
          { name: 'light-bg', color: '#ffffff' },
        ],
      });
      render(<IssueContextDisplay issueContext={issue} />);

      const darkBgPill = screen.getByText('dark-bg');
      // Dark background should get light text
      expect(darkBgPill.style.color).toBe('#f5f0eb');

      const lightBgPill = screen.getByText('light-bg');
      // Light background should get dark text
      expect(lightBgPill.style.color).toBe('#1a1a19');
    });

    it('does not render labels container when labels are empty', () => {
      const issue = makeIssueContext({ labels: [] });
      render(<IssueContextDisplay issueContext={issue} />);

      expect(screen.queryByLabelText('Issue labels')).not.toBeInTheDocument();
    });

    it('does not render labels container when labels are undefined', () => {
      const issue = makeIssueContext({ labels: undefined });
      render(<IssueContextDisplay issueContext={issue} />);

      expect(screen.queryByLabelText('Issue labels')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Summary toggle
  // -------------------------------------------------------------------------

  describe('summary toggle', () => {
    it('shows toggle button when summary is present', () => {
      const issue = makeIssueContext();
      render(<IssueContextDisplay issueContext={issue} />);

      const toggleButton = screen.getByRole('button', { name: /show summary/i });
      expect(toggleButton).toBeInTheDocument();
    });

    it('does not show toggle button when summary is absent', () => {
      const issue = makeIssueContext({ summary: undefined });
      render(<IssueContextDisplay issueContext={issue} />);

      expect(screen.queryByRole('button', { name: /summary/i })).not.toBeInTheDocument();
    });

    it('does not show toggle button when summary is empty string', () => {
      const issue = makeIssueContext({ summary: '' });
      render(<IssueContextDisplay issueContext={issue} />);

      expect(screen.queryByRole('button', { name: /summary/i })).not.toBeInTheDocument();
    });

    it('toggles summary visibility on button click', async () => {
      const issue = makeIssueContext();
      const user = userEvent.setup();
      render(<IssueContextDisplay issueContext={issue} />);

      // Initially summary is hidden
      expect(screen.queryByText(/OAuth callback/)).not.toBeInTheDocument();

      // Click to show
      const toggleButton = screen.getByRole('button', { name: /show summary/i });
      await user.click(toggleButton);

      // Summary should now be visible
      expect(screen.getByText(/OAuth callback/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /hide summary/i })).toBeInTheDocument();

      // Click to hide
      await user.click(screen.getByRole('button', { name: /hide summary/i }));

      // Summary should be hidden again
      expect(screen.queryByText(/OAuth callback/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /show summary/i })).toBeInTheDocument();
    });

    it('sets aria-expanded correctly', async () => {
      const issue = makeIssueContext();
      const user = userEvent.setup();
      render(<IssueContextDisplay issueContext={issue} />);

      const toggleButton = screen.getByRole('button', { name: /show summary/i });
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

      await user.click(toggleButton);
      expect(screen.getByRole('button', { name: /hide summary/i })).toHaveAttribute(
        'aria-expanded',
        'true'
      );
    });

    it('truncates summary at 250 characters with ellipsis', async () => {
      const longSummary = 'A'.repeat(300);
      const issue = makeIssueContext({ summary: longSummary });
      const user = userEvent.setup();
      render(<IssueContextDisplay issueContext={issue} />);

      await user.click(screen.getByRole('button', { name: /show summary/i }));

      const summaryEl = screen.getByText(/A+\u2026/);
      expect(summaryEl).toBeInTheDocument();
      // 250 chars + ellipsis character
      expect(summaryEl.textContent!.length).toBe(251);
    });

    it('does not truncate summary at or under 250 characters', async () => {
      const shortSummary = 'B'.repeat(250);
      const issue = makeIssueContext({ summary: shortSummary });
      const user = userEvent.setup();
      render(<IssueContextDisplay issueContext={issue} />);

      await user.click(screen.getByRole('button', { name: /show summary/i }));

      const summaryEl = screen.getByText('B'.repeat(250));
      expect(summaryEl).toBeInTheDocument();
      expect(summaryEl.textContent).not.toContain('\u2026');
    });
  });

  // -------------------------------------------------------------------------
  // Auto-contrast color helper
  // -------------------------------------------------------------------------

  describe('getContrastColor', () => {
    it('returns light text for dark backgrounds', () => {
      // Pure black
      expect(getContrastColor('#000000')).toBe('#f5f0eb');
      // Dark red
      expect(getContrastColor('#d73a4a')).toBe('#f5f0eb');
      // Dark green
      expect(getContrastColor('#0e8a16')).toBe('#f5f0eb');
      // Dark blue
      expect(getContrastColor('#0052cc')).toBe('#f5f0eb');
    });

    it('returns dark text for light backgrounds', () => {
      // Pure white
      expect(getContrastColor('#ffffff')).toBe('#1a1a19');
      // Light yellow
      expect(getContrastColor('#fbca04')).toBe('#1a1a19');
      // Light green
      expect(getContrastColor('#a2eeef')).toBe('#1a1a19');
      // Light pink
      expect(getContrastColor('#f9d0c4')).toBe('#1a1a19');
    });

    it('handles hex strings without # prefix', () => {
      expect(getContrastColor('000000')).toBe('#f5f0eb');
      expect(getContrastColor('ffffff')).toBe('#1a1a19');
    });
  });
});
