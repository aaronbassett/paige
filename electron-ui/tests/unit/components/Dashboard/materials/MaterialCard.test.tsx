/**
 * Unit tests for MaterialCard component.
 *
 * Covers:
 *   - Renders title and description
 *   - Displays view count text (singular, plural, zero)
 *   - Renders thumbnail image when thumbnailUrl is provided
 *   - Renders placeholder icon when thumbnailUrl is null
 *   - Shows correct type badge (VID for youtube, DOC for article)
 *   - Calls onView with material id when view button is clicked
 *   - Calls onComplete with material id when complete button is clicked
 *   - Calls onDismiss with material id when dismiss button is clicked
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import type { LearningMaterial } from '@shared/types/entities';

// ---------------------------------------------------------------------------
// Mocks -- framer-motion does not work well with happy-dom
// ---------------------------------------------------------------------------

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      style,
      // Filter out framer-motion-specific props so they are not forwarded to the DOM
      layout: _layout,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      ...rest
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div style={style as React.CSSProperties} {...rest}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Import after mocks are in place
import { MaterialCard } from '../../../../../renderer/src/components/Dashboard/materials/MaterialCard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMaterial(overrides?: Partial<LearningMaterial>): LearningMaterial {
  return {
    id: 1,
    type: 'youtube',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Learn React Hooks',
    description: 'A great intro to React hooks',
    thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
    question: 'What is useState?',
    viewCount: 3,
    status: 'pending',
    createdAt: '2026-02-15T00:00:00Z',
    ...overrides,
  };
}

function renderCard(
  overrides?: Partial<LearningMaterial>,
  handlers?: Partial<{
    onView: ReturnType<typeof vi.fn>;
    onComplete: ReturnType<typeof vi.fn>;
    onDismiss: ReturnType<typeof vi.fn>;
  }>
) {
  const props = {
    material: makeMaterial(overrides),
    onView: handlers?.onView ?? vi.fn(),
    onComplete: handlers?.onComplete ?? vi.fn(),
    onDismiss: handlers?.onDismiss ?? vi.fn(),
  };
  return render(<MaterialCard {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MaterialCard', () => {
  // -------------------------------------------------------------------------
  // Content rendering
  // -------------------------------------------------------------------------

  describe('content rendering', () => {
    it('renders title and description', () => {
      renderCard();
      expect(screen.getByText('Learn React Hooks')).toBeInTheDocument();
      expect(screen.getByText('A great intro to React hooks')).toBeInTheDocument();
    });

    it('shows plural view count when viewCount > 1', () => {
      renderCard({ viewCount: 5 });
      expect(screen.getByText('Viewed 5 times')).toBeInTheDocument();
    });

    it('shows singular view count when viewCount is 1', () => {
      renderCard({ viewCount: 1 });
      expect(screen.getByText('Viewed 1 time')).toBeInTheDocument();
    });

    it('shows "Not yet viewed" when viewCount is 0', () => {
      renderCard({ viewCount: 0 });
      expect(screen.getByText('Not yet viewed')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Thumbnail
  // -------------------------------------------------------------------------

  describe('thumbnail', () => {
    it('renders thumbnail image when thumbnailUrl is provided', () => {
      renderCard();
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
      expect(img).toHaveAttribute('alt', 'Learn React Hooks');
    });

    it('renders placeholder icon when thumbnailUrl is null', () => {
      renderCard({ thumbnailUrl: null });
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      // The placeholder div should exist with a play icon for youtube
      expect(screen.getByText('\u25B6')).toBeInTheDocument();
    });

    it('renders document icon for article type without thumbnail', () => {
      renderCard({ type: 'article', thumbnailUrl: null });
      expect(screen.getByText('\u2759')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Type badge
  // -------------------------------------------------------------------------

  describe('type badge', () => {
    it('shows VID badge for youtube type', () => {
      renderCard({ type: 'youtube' });
      expect(screen.getByText('VID')).toBeInTheDocument();
    });

    it('shows DOC badge for article type', () => {
      renderCard({ type: 'article' });
      expect(screen.getByText('DOC')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Action buttons
  // -------------------------------------------------------------------------

  describe('action buttons', () => {
    it('calls onView with material id when view button is clicked', async () => {
      const user = userEvent.setup();
      const onView = vi.fn();
      renderCard({ id: 42 }, { onView });
      await user.click(screen.getByLabelText('View material'));
      expect(onView).toHaveBeenCalledTimes(1);
      expect(onView).toHaveBeenCalledWith(42);
    });

    it('calls onComplete with material id when complete button is clicked', async () => {
      const user = userEvent.setup();
      const onComplete = vi.fn();
      renderCard({ id: 7 }, { onComplete });
      await user.click(screen.getByLabelText('Complete material'));
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(7);
    });

    it('calls onDismiss with material id when dismiss button is clicked', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      renderCard({ id: 99 }, { onDismiss });
      await user.click(screen.getByLabelText('Dismiss material'));
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledWith(99);
    });

    it('has accessible labels on all action buttons', () => {
      renderCard();
      expect(screen.getByLabelText('View material')).toBeInTheDocument();
      expect(screen.getByLabelText('Complete material')).toBeInTheDocument();
      expect(screen.getByLabelText('Dismiss material')).toBeInTheDocument();
    });

    it('has tooltip titles on all action buttons', () => {
      renderCard();
      expect(screen.getByTitle('Open in browser')).toBeInTheDocument();
      expect(screen.getByTitle('Mark as complete')).toBeInTheDocument();
      expect(screen.getByTitle('Dismiss')).toBeInTheDocument();
    });
  });
});
