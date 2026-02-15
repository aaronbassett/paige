/**
 * Review navigation service for the Paige Electron UI.
 *
 * Singleton service that manages the "Review My Work" flow. When the backend
 * sends review results (via WebSocket), this service stores the review comments
 * and provides navigation (next/previous/current) between them.
 *
 * React components subscribe to state changes via the listener API and
 * re-render when notified (same pattern as editor-state.ts, hint-manager.ts).
 *
 * This service is the single source of truth for all review navigation state.
 */

import type { ReviewComment } from '@shared/types/entities';
import { getLogger } from '../logger';

const logger = getLogger(['paige', 'renderer', 'review']);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Snapshot of the current review navigation state. */
export interface ReviewState {
  /** Whether a review is currently active. */
  active: boolean;
  /** The scope of the current review (e.g., file path or "project"). */
  scope: string;
  /** All comments in the current review, ordered by path then startLine. */
  comments: ReviewComment[];
  /** Index of the currently focused comment (0-based). */
  currentIndex: number;
  /** Total comment count. */
  total: number;
}

/** Listener callback invoked whenever review state changes. */
export type ReviewNavigationListener = () => void;

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

/** Factory for a clean initial state. */
function createInitialState(): ReviewState {
  return {
    active: false,
    scope: '',
    comments: [],
    currentIndex: 0,
    total: 0,
  };
}

// ---------------------------------------------------------------------------
// ReviewNavigationService
// ---------------------------------------------------------------------------

/**
 * Manages the "Review My Work" flow: stores review comments from the backend
 * and provides next/previous/current navigation between them.
 *
 * @example
 * ```ts
 * import { reviewNavigation } from './services/review-navigation';
 *
 * reviewNavigation.startReview('project', [
 *   { messageId: '1', path: '/src/App.tsx', range: { startLine: 10, startColumn: 1, endLine: 12, endColumn: 1 }, message: 'Consider extracting this', type: 'hint' },
 * ]);
 *
 * const comment = reviewNavigation.getCurrentComment();
 * reviewNavigation.next();
 *
 * const unsubscribe = reviewNavigation.subscribe(() => {
 *   console.log('Review state changed');
 * });
 * unsubscribe();
 * ```
 */
class ReviewNavigationService {
  private state: ReviewState = createInitialState();

  /** Set of subscribed listeners notified on every state mutation. */
  private listeners = new Set<ReviewNavigationListener>();

  // -------------------------------------------------------------------------
  // Subscription
  // -------------------------------------------------------------------------

  /**
   * Subscribe to review state changes. The listener is called (with no
   * arguments) whenever the review state mutates. Returns an unsubscribe
   * function.
   *
   * @param listener - Callback invoked on state change.
   * @returns A function that removes the listener when called.
   */
  subscribe(listener: ReviewNavigationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  /**
   * Get current review state as a readonly snapshot for React integration.
   * Safe to use with `useSyncExternalStore`.
   */
  getState(): Readonly<ReviewState> {
    return this.state;
  }

  /**
   * Get the currently focused comment, or null if no review is active
   * or there are no comments.
   */
  getCurrentComment(): ReviewComment | null {
    if (!this.state.active || this.state.total === 0) {
      return null;
    }
    return this.state.comments[this.state.currentIndex] ?? null;
  }

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  /**
   * Start a new review with the given comments. Replaces any previous review.
   * Comments are sorted by path (alphabetical), then by startLine (ascending).
   *
   * @param scope - The scope of the review (e.g., file path or "project").
   * @param comments - Array of review comments from the backend.
   */
  startReview(scope: string, comments: ReviewComment[]): void {
    const sorted = [...comments].sort((a, b) => {
      const pathCmp = a.path.localeCompare(b.path);
      if (pathCmp !== 0) return pathCmp;
      return a.range.startLine - b.range.startLine;
    });

    this.state = {
      active: true,
      scope,
      comments: sorted,
      currentIndex: 0,
      total: sorted.length,
    };
    this.notify();
  }

  /**
   * Navigate to the next comment. Wraps around from the last to the first.
   *
   * @returns The newly focused comment, or null if no review is active.
   */
  next(): ReviewComment | null {
    if (!this.state.active || this.state.total === 0) return null;

    this.state = {
      ...this.state,
      currentIndex: (this.state.currentIndex + 1) % this.state.total,
    };
    this.notify();
    return this.state.comments[this.state.currentIndex] ?? null;
  }

  /**
   * Navigate to the previous comment. Wraps around from the first to the last.
   *
   * @returns The newly focused comment, or null if no review is active.
   */
  previous(): ReviewComment | null {
    if (!this.state.active || this.state.total === 0) return null;

    this.state = {
      ...this.state,
      currentIndex: (this.state.currentIndex - 1 + this.state.total) % this.state.total,
    };
    this.notify();
    return this.state.comments[this.state.currentIndex] ?? null;
  }

  /**
   * Exit review mode. Clears all review comments and resets to initial state.
   */
  exitReview(): void {
    this.state = createInitialState();
    this.notify();
  }

  /**
   * Remove a specific comment by its messageId (e.g., when the user closes
   * the tab containing the comment). Adjusts the current index so the user
   * does not jump to an unexpected comment.
   *
   * If the last comment is removed, the review is exited automatically.
   *
   * @param messageId - The unique ID of the comment to remove.
   */
  removeComment(messageId: string): void {
    if (!this.state.active) return;

    const idx = this.state.comments.findIndex((c) => c.messageId === messageId);
    if (idx < 0) return;

    const newComments = this.state.comments.filter((c) => c.messageId !== messageId);
    const newTotal = newComments.length;

    if (newTotal === 0) {
      this.exitReview();
      return;
    }

    // Adjust index: if removed comment was before current, shift back by one.
    // If removed was AT current, stay at same index (now pointing to what was
    // the next comment). If that puts us past the end, wrap to the last valid.
    let newIndex = this.state.currentIndex;
    if (idx < this.state.currentIndex) {
      newIndex--;
    } else if (idx === this.state.currentIndex) {
      if (newIndex >= newTotal) {
        newIndex = newTotal - 1;
      }
    }

    this.state = {
      ...this.state,
      comments: newComments,
      currentIndex: newIndex,
      total: newTotal,
    };
    this.notify();
  }

  // -------------------------------------------------------------------------
  // Internal: notification
  // -------------------------------------------------------------------------

  /** Notify all subscribed listeners of a state change. */
  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error`Listener error: ${message}`;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

/** Singleton review navigation service instance for the application. */
export const reviewNavigation = new ReviewNavigationService();

export { ReviewNavigationService };
