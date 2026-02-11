/**
 * Unit tests for the ReviewNavigationService.
 *
 * Covers starting/exiting reviews, comment sorting, next/previous navigation
 * with wrap-around, current comment retrieval, comment removal with index
 * adjustment, subscription/notification lifecycle, and edge cases.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReviewNavigationService } from '../../../renderer/src/services/review-navigation';
import type { ReviewComment, CoachingMessageType } from '@shared/types/entities';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createService(): ReviewNavigationService {
  return new ReviewNavigationService();
}

/** Create a review comment with sensible defaults. */
function makeComment(
  overrides: Partial<ReviewComment> & { messageId: string },
): ReviewComment {
  return {
    path: '/src/App.tsx',
    range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 10 },
    message: 'Test comment',
    type: 'hint' as CoachingMessageType,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReviewNavigationService', () => {
  let service: ReviewNavigationService;

  beforeEach(() => {
    service = createService();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  describe('initial state', () => {
    it('starts with active false and empty comments', () => {
      const state = service.getState();

      expect(state.active).toBe(false);
      expect(state.scope).toBe('');
      expect(state.comments).toEqual([]);
      expect(state.currentIndex).toBe(0);
      expect(state.total).toBe(0);
    });

    it('getCurrentComment returns null when no review is active', () => {
      expect(service.getCurrentComment()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // startReview
  // -------------------------------------------------------------------------

  describe('startReview', () => {
    it('sets active to true with the given scope', () => {
      const comments = [makeComment({ messageId: '1' })];

      service.startReview('project', comments);

      const state = service.getState();
      expect(state.active).toBe(true);
      expect(state.scope).toBe('project');
    });

    it('stores comments with total count and currentIndex at 0', () => {
      const comments = [
        makeComment({ messageId: '1' }),
        makeComment({ messageId: '2' }),
        makeComment({ messageId: '3' }),
      ];

      service.startReview('/src/App.tsx', comments);

      const state = service.getState();
      expect(state.total).toBe(3);
      expect(state.currentIndex).toBe(0);
      expect(state.comments).toHaveLength(3);
    });

    it('sorts comments by path alphabetically then by startLine ascending', () => {
      const comments = [
        makeComment({
          messageId: '3',
          path: '/src/B.tsx',
          range: { startLine: 20, startColumn: 1, endLine: 22, endColumn: 1 },
        }),
        makeComment({
          messageId: '1',
          path: '/src/A.tsx',
          range: { startLine: 5, startColumn: 1, endLine: 7, endColumn: 1 },
        }),
        makeComment({
          messageId: '2',
          path: '/src/A.tsx',
          range: { startLine: 15, startColumn: 1, endLine: 17, endColumn: 1 },
        }),
        makeComment({
          messageId: '4',
          path: '/src/B.tsx',
          range: { startLine: 1, startColumn: 1, endLine: 3, endColumn: 1 },
        }),
      ];

      service.startReview('project', comments);

      const sorted = service.getState().comments;
      expect(sorted[0]!.messageId).toBe('1'); // A.tsx line 5
      expect(sorted[1]!.messageId).toBe('2'); // A.tsx line 15
      expect(sorted[2]!.messageId).toBe('4'); // B.tsx line 1
      expect(sorted[3]!.messageId).toBe('3'); // B.tsx line 20
    });

    it('replaces a previous review when starting a new one', () => {
      const oldComments = [
        makeComment({ messageId: 'old-1' }),
        makeComment({ messageId: 'old-2' }),
      ];
      service.startReview('old-scope', oldComments);

      // Navigate forward so currentIndex is 1
      service.next();
      expect(service.getState().currentIndex).toBe(1);

      const newComments = [makeComment({ messageId: 'new-1' })];
      service.startReview('new-scope', newComments);

      const state = service.getState();
      expect(state.scope).toBe('new-scope');
      expect(state.total).toBe(1);
      expect(state.currentIndex).toBe(0);
      expect(state.comments[0]!.messageId).toBe('new-1');
    });

    it('handles starting a review with zero comments', () => {
      service.startReview('empty-scope', []);

      const state = service.getState();
      expect(state.active).toBe(true);
      expect(state.total).toBe(0);
      expect(state.comments).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // next
  // -------------------------------------------------------------------------

  describe('next', () => {
    it('advances index by one and returns the new comment', () => {
      const comments = [
        makeComment({ messageId: '1', message: 'first' }),
        makeComment({ messageId: '2', message: 'second' }),
        makeComment({ messageId: '3', message: 'third' }),
      ];
      service.startReview('test', comments);

      const result = service.next();

      expect(result).not.toBeNull();
      expect(result!.messageId).toBe('2');
      expect(service.getState().currentIndex).toBe(1);
    });

    it('wraps around from the last comment to the first', () => {
      const comments = [
        makeComment({ messageId: '1' }),
        makeComment({ messageId: '2' }),
      ];
      service.startReview('test', comments);

      service.next(); // index 1
      const wrapped = service.next(); // should wrap to index 0

      expect(wrapped!.messageId).toBe('1');
      expect(service.getState().currentIndex).toBe(0);
    });

    it('returns null when no review is active', () => {
      expect(service.next()).toBeNull();
    });

    it('returns null when review has zero comments', () => {
      service.startReview('empty', []);
      expect(service.next()).toBeNull();
    });

    it('returns the same comment when there is only one', () => {
      service.startReview('single', [makeComment({ messageId: '1' })]);

      const result = service.next();

      expect(result!.messageId).toBe('1');
      expect(service.getState().currentIndex).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // previous
  // -------------------------------------------------------------------------

  describe('previous', () => {
    it('goes back by one and returns the new comment', () => {
      const comments = [
        makeComment({ messageId: '1' }),
        makeComment({ messageId: '2' }),
        makeComment({ messageId: '3' }),
      ];
      service.startReview('test', comments);
      service.next(); // index 1
      service.next(); // index 2

      const result = service.previous();

      expect(result!.messageId).toBe('2');
      expect(service.getState().currentIndex).toBe(1);
    });

    it('wraps around from the first comment to the last', () => {
      const comments = [
        makeComment({ messageId: '1' }),
        makeComment({ messageId: '2' }),
        makeComment({ messageId: '3' }),
      ];
      service.startReview('test', comments);

      // currentIndex is 0, going previous should wrap to last
      const wrapped = service.previous();

      expect(wrapped!.messageId).toBe('3');
      expect(service.getState().currentIndex).toBe(2);
    });

    it('returns null when no review is active', () => {
      expect(service.previous()).toBeNull();
    });

    it('returns null when review has zero comments', () => {
      service.startReview('empty', []);
      expect(service.previous()).toBeNull();
    });

    it('returns the same comment when there is only one', () => {
      service.startReview('single', [makeComment({ messageId: '1' })]);

      const result = service.previous();

      expect(result!.messageId).toBe('1');
      expect(service.getState().currentIndex).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // getCurrentComment
  // -------------------------------------------------------------------------

  describe('getCurrentComment', () => {
    it('returns the comment at the current index', () => {
      const comments = [
        makeComment({ messageId: '1', message: 'first' }),
        makeComment({ messageId: '2', message: 'second' }),
      ];
      service.startReview('test', comments);

      expect(service.getCurrentComment()!.messageId).toBe('1');

      service.next();
      expect(service.getCurrentComment()!.messageId).toBe('2');
    });

    it('returns null when review is not active', () => {
      expect(service.getCurrentComment()).toBeNull();
    });

    it('returns null when review has zero comments', () => {
      service.startReview('empty', []);
      expect(service.getCurrentComment()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // exitReview
  // -------------------------------------------------------------------------

  describe('exitReview', () => {
    it('resets to initial state', () => {
      service.startReview('test', [
        makeComment({ messageId: '1' }),
        makeComment({ messageId: '2' }),
      ]);
      service.next();

      service.exitReview();

      const state = service.getState();
      expect(state.active).toBe(false);
      expect(state.scope).toBe('');
      expect(state.comments).toEqual([]);
      expect(state.currentIndex).toBe(0);
      expect(state.total).toBe(0);
    });

    it('is safe to call when no review is active', () => {
      // Should not throw
      service.exitReview();

      const state = service.getState();
      expect(state.active).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // removeComment
  // -------------------------------------------------------------------------

  describe('removeComment', () => {
    it('removes the specified comment by messageId', () => {
      const comments = [
        makeComment({ messageId: '1' }),
        makeComment({ messageId: '2' }),
        makeComment({ messageId: '3' }),
      ];
      service.startReview('test', comments);

      service.removeComment('2');

      const state = service.getState();
      expect(state.total).toBe(2);
      expect(state.comments.map((c) => c.messageId)).toEqual(['1', '3']);
    });

    it('exits review when the last comment is removed', () => {
      service.startReview('test', [makeComment({ messageId: '1' })]);

      service.removeComment('1');

      const state = service.getState();
      expect(state.active).toBe(false);
      expect(state.total).toBe(0);
    });

    it('decrements currentIndex when removed comment is before current', () => {
      const comments = [
        makeComment({ messageId: '1' }),
        makeComment({ messageId: '2' }),
        makeComment({ messageId: '3' }),
      ];
      service.startReview('test', comments);
      service.next(); // index 1 (pointing at '2')
      service.next(); // index 2 (pointing at '3')

      // Remove comment at index 0 (before current)
      service.removeComment('1');

      // Index should shift from 2 to 1 (still pointing at '3')
      expect(service.getState().currentIndex).toBe(1);
      expect(service.getCurrentComment()!.messageId).toBe('3');
    });

    it('keeps currentIndex when removed comment is at current (points to next)', () => {
      const comments = [
        makeComment({ messageId: '1' }),
        makeComment({ messageId: '2' }),
        makeComment({ messageId: '3' }),
      ];
      service.startReview('test', comments);
      service.next(); // index 1 (pointing at '2')

      // Remove the current comment ('2')
      service.removeComment('2');

      // Index stays at 1, now pointing at what was '3'
      expect(service.getState().currentIndex).toBe(1);
      expect(service.getCurrentComment()!.messageId).toBe('3');
    });

    it('wraps currentIndex to last valid when removing current at end', () => {
      const comments = [
        makeComment({ messageId: '1' }),
        makeComment({ messageId: '2' }),
        makeComment({ messageId: '3' }),
      ];
      service.startReview('test', comments);
      service.next(); // index 1
      service.next(); // index 2 (last comment, '3')

      // Remove the last comment while it is current
      service.removeComment('3');

      // Index should wrap to 1 (new last valid index)
      expect(service.getState().currentIndex).toBe(1);
      expect(service.getCurrentComment()!.messageId).toBe('2');
    });

    it('does not change currentIndex when removed comment is after current', () => {
      const comments = [
        makeComment({ messageId: '1' }),
        makeComment({ messageId: '2' }),
        makeComment({ messageId: '3' }),
      ];
      service.startReview('test', comments);
      // currentIndex is 0

      // Remove comment at index 2 (after current)
      service.removeComment('3');

      expect(service.getState().currentIndex).toBe(0);
      expect(service.getCurrentComment()!.messageId).toBe('1');
    });

    it('is a no-op when messageId does not exist', () => {
      const comments = [makeComment({ messageId: '1' })];
      service.startReview('test', comments);

      const listener = vi.fn();
      service.subscribe(listener);

      service.removeComment('nonexistent');

      expect(listener).not.toHaveBeenCalled();
      expect(service.getState().total).toBe(1);
    });

    it('is a no-op when no review is active', () => {
      service.removeComment('anything');

      // Should not throw, state stays inactive
      expect(service.getState().active).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // subscribe / notify
  // -------------------------------------------------------------------------

  describe('subscribe/notify', () => {
    it('notifies listener on startReview', () => {
      const listener = vi.fn();
      service.subscribe(listener);

      service.startReview('test', [makeComment({ messageId: '1' })]);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listener on next', () => {
      service.startReview('test', [
        makeComment({ messageId: '1' }),
        makeComment({ messageId: '2' }),
      ]);

      const listener = vi.fn();
      service.subscribe(listener);

      service.next();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listener on previous', () => {
      service.startReview('test', [
        makeComment({ messageId: '1' }),
        makeComment({ messageId: '2' }),
      ]);

      const listener = vi.fn();
      service.subscribe(listener);

      service.previous();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listener on exitReview', () => {
      service.startReview('test', [makeComment({ messageId: '1' })]);

      const listener = vi.fn();
      service.subscribe(listener);

      service.exitReview();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listener on removeComment', () => {
      service.startReview('test', [
        makeComment({ messageId: '1' }),
        makeComment({ messageId: '2' }),
      ]);

      const listener = vi.fn();
      service.subscribe(listener);

      service.removeComment('1');

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('stops notifying after unsubscribe', () => {
      const listener = vi.fn();
      const unsubscribe = service.subscribe(listener);

      service.startReview('test', [makeComment({ messageId: '1' })]);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      service.exitReview();
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('supports multiple concurrent listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      service.subscribe(listener1);
      service.subscribe(listener2);
      service.subscribe(listener3);

      service.startReview('test', [makeComment({ messageId: '1' })]);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
    });

    it('continues notifying remaining listeners when one throws', () => {
      const listener1 = vi.fn();
      const throwingListener = vi.fn().mockImplementation(() => {
        throw new Error('test error');
      });
      const listener3 = vi.fn();

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      service.subscribe(listener1);
      service.subscribe(throwingListener);
      service.subscribe(listener3);

      service.startReview('test', [makeComment({ messageId: '1' })]);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(throwingListener).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ReviewNavigationService] Listener error:',
        'test error',
      );

      consoleSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // Full navigation cycle
  // -------------------------------------------------------------------------

  describe('full navigation cycle', () => {
    it('supports a complete review workflow', () => {
      const comments = [
        makeComment({
          messageId: 'c1',
          path: '/src/A.tsx',
          range: { startLine: 10, startColumn: 1, endLine: 12, endColumn: 1 },
          message: 'Extract this function',
        }),
        makeComment({
          messageId: 'c2',
          path: '/src/A.tsx',
          range: { startLine: 30, startColumn: 1, endLine: 35, endColumn: 1 },
          message: 'Add error handling',
        }),
        makeComment({
          messageId: 'c3',
          path: '/src/B.tsx',
          range: { startLine: 5, startColumn: 1, endLine: 8, endColumn: 1 },
          message: 'Simplify this condition',
        }),
      ];

      // Start review
      service.startReview('/src', comments);
      expect(service.getState().active).toBe(true);
      expect(service.getState().total).toBe(3);

      // First comment
      expect(service.getCurrentComment()!.messageId).toBe('c1');

      // Navigate forward
      service.next();
      expect(service.getCurrentComment()!.messageId).toBe('c2');

      service.next();
      expect(service.getCurrentComment()!.messageId).toBe('c3');

      // Wrap around
      service.next();
      expect(service.getCurrentComment()!.messageId).toBe('c1');

      // Navigate backward
      service.previous();
      expect(service.getCurrentComment()!.messageId).toBe('c3');

      // Remove a comment
      service.removeComment('c2');
      expect(service.getState().total).toBe(2);

      // Exit review
      service.exitReview();
      expect(service.getState().active).toBe(false);
      expect(service.getCurrentComment()).toBeNull();
    });
  });
});
