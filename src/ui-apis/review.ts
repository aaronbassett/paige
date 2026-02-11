// Practice Review — kata solution review with constraint unlocking (T355)

import type { PracticeSubmitSolutionData } from '../types/websocket.js';

/** Result of a Practice Review request. */
export interface ReviewResult {
  review: string;
  level: number;
  passed: boolean;
  constraintsUnlocked: string[];
}

/**
 * Handles a "practice:submit_solution" request: loads kata, filters previous
 * attempts by matching constraints, calls Sonnet, persists attempt, and
 * computes constraint unlocking.
 */
export function handlePracticeReview(
  _data: PracticeSubmitSolutionData,
  _sessionId: number,
): Promise<ReviewResult> {
  return Promise.reject(new Error('Not implemented'));
}
