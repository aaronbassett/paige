/**
 * React hook bridging the reviewNavigation singleton service with React state.
 *
 * Subscribes to the singleton ReviewNavigationService for reactive updates,
 * and listens for `coaching:review_result` WebSocket messages to start a new
 * review when the backend sends review results.
 *
 * Usage:
 * ```tsx
 * function IDE() {
 *   const { reviewState, focusedMessageId, next, previous, exitReview, reviewComments } =
 *     useReviewNavigation();
 *
 *   return (
 *     <StatusBar
 *       reviewActive={reviewState.active}
 *       reviewCurrentIndex={reviewState.currentIndex}
 *       reviewTotal={reviewState.total}
 *       onReviewNext={next}
 *       onReviewPrevious={previous}
 *       onReviewExit={exitReview}
 *     />
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { reviewNavigation } from '../services/review-navigation';
import type { ReviewComment } from '@shared/types/entities';
import type {
  WebSocketMessage,
  CoachingReviewResultMessage,
} from '@shared/types/websocket-messages';
import { useWebSocket } from './useWebSocket';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseReviewNavigationReturn {
  /** Current review state snapshot. */
  reviewState: {
    active: boolean;
    scope: string;
    currentIndex: number;
    total: number;
  };
  /** MessageId of the currently focused review comment (for emphasizing). */
  focusedMessageId: string | undefined;
  /** Navigate to the next review comment. */
  next: () => void;
  /** Navigate to the previous review comment. */
  previous: () => void;
  /** Exit review mode and clear all review comments. */
  exitReview: () => void;
  /** All review comments (for rendering as balloons). */
  reviewComments: ReviewComment[];
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useReviewNavigation(): UseReviewNavigationReturn {
  const { on } = useWebSocket();

  // Subscribe to reviewNavigation service state
  const [state, setState] = useState(() => ({ ...reviewNavigation.getState() }));

  useEffect(() => {
    const unsubscribe = reviewNavigation.subscribe(() => {
      setState({ ...reviewNavigation.getState() });
    });
    return unsubscribe;
  }, []);

  // Listen for coaching:review_result WebSocket message
  useEffect(() => {
    const unsubscribe = on('coaching:review_result', (msg: WebSocketMessage) => {
      const { payload } = msg as CoachingReviewResultMessage;
      reviewNavigation.startReview(payload.scope, payload.comments);
    });
    return unsubscribe;
  }, [on]);

  const focusedComment = reviewNavigation.getCurrentComment();

  const next = useCallback(() => {
    reviewNavigation.next();
  }, []);

  const previous = useCallback(() => {
    reviewNavigation.previous();
  }, []);

  const exitReview = useCallback(() => {
    reviewNavigation.exitReview();
  }, []);

  return {
    reviewState: {
      active: state.active,
      scope: state.scope,
      currentIndex: state.currentIndex,
      total: state.total,
    },
    focusedMessageId: focusedComment?.messageId,
    next,
    previous,
    exitReview,
    reviewComments: state.comments,
  };
}
