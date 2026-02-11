// Practice Review — kata solution review with constraint unlocking (T355)

import { callApi } from '../api-client/claude.js';
import { practiceReviewSchema } from '../api-client/schemas.js';
import { getDatabase } from '../database/db.js';
import { getKataById, updateKataAttempts } from '../database/queries/katas.js';
import { logAction } from '../logger/action-log.js';
import type { KataAttempt, KataConstraint } from '../types/domain.js';
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
export async function handlePracticeReview(
  data: PracticeSubmitSolutionData,
  sessionId: number,
): Promise<ReviewResult> {
  const db = getDatabase()!;

  // Load kata — throw if not found so handler broadcasts review:error
  const kata = await getKataById(db, data.kataId);
  if (kata === null) {
    throw new Error(`Kata not found (id=${data.kataId})`);
  }

  // Log practice_solution_submitted BEFORE the API call
  await logAction(db, sessionId, 'practice_solution_submitted', {
    kataId: data.kataId,
    code: data.code,
  });

  // Parse existing attempts from the kata
  const existingAttempts = JSON.parse(kata.user_attempts) as KataAttempt[];

  // Same-constraint filtering: keep only attempts whose constraints exactly
  // match the current activeConstraints (same elements, same order via JSON.stringify)
  const activeConstraintsKey = JSON.stringify([...data.activeConstraints]);
  const matchingAttempts = existingAttempts.filter(
    (attempt) => JSON.stringify(attempt.constraints) === activeConstraintsKey,
  );

  // Parse all kata constraints for building the user message
  const allConstraints = JSON.parse(kata.constraints) as KataConstraint[];

  // Build active constraints info for the prompt
  const activeConstraintDescriptions = allConstraints
    .filter((c) => data.activeConstraints.includes(c.id))
    .map((c) => `- ${c.id}: ${c.description} (minLevel ${c.minLevel})`)
    .join('\n');

  // Build previous attempts section for the prompt
  let previousAttemptsSection = '';
  if (matchingAttempts.length > 0) {
    previousAttemptsSection = '\n\n## Previous Attempts (same constraint set)\n';
    for (const attempt of matchingAttempts) {
      previousAttemptsSection += `\n### Attempt (level ${attempt.level}, ${attempt.passed ? 'passed' : 'failed'})\n`;
      previousAttemptsSection += `Code:\n${attempt.code}\n`;
      previousAttemptsSection += `Review:\n${attempt.review}\n`;
    }
  }

  // Build the user message for Sonnet
  const userMessage =
    `## Kata Description\n${kata.description}\n\n` +
    `## Submitted Solution\n${data.code}\n\n` +
    `## Active Constraints\n${activeConstraintDescriptions || 'None'}` +
    previousAttemptsSection;

  // Call Sonnet for the review
  const apiResult = await callApi({
    callType: 'practice_review',
    model: 'sonnet',
    sessionId,
    systemPrompt:
      'You are a coding kata reviewer. Review the submitted solution against the kata description and active constraints. ' +
      'Assign a level (1-10) indicating solution quality, and determine if the solution passes. ' +
      'Provide constructive feedback.',
    userMessage,
    responseSchema: practiceReviewSchema,
  });

  // Create new attempt record
  const newAttempt: KataAttempt = {
    code: data.code,
    review: apiResult.review,
    level: apiResult.level,
    passed: apiResult.passed,
    constraints: [...data.activeConstraints],
    submitted_at: new Date().toISOString(),
  };

  // Append to all existing attempts (not just matching ones)
  const allAttempts = [...existingAttempts, newAttempt];

  // Persist updated attempts
  await updateKataAttempts(db, kata.id, JSON.stringify(allAttempts));

  // Constraint unlocking logic:
  // maxLevel from ALL attempts (including the new one)
  const maxLevel = Math.max(...allAttempts.map((a) => a.level));

  // Find constraints that are newly unlockable:
  // c.minLevel <= maxLevel AND c.id is NOT in data.activeConstraints
  const constraintsUnlocked = allConstraints
    .filter((c) => c.minLevel <= maxLevel && !data.activeConstraints.includes(c.id))
    .map((c) => c.id);

  // Log practice_solution_reviewed AFTER the API call
  await logAction(db, sessionId, 'practice_solution_reviewed', {
    kataId: data.kataId,
    level: apiResult.level,
    passed: apiResult.passed,
  });

  return {
    review: apiResult.review,
    level: apiResult.level,
    passed: apiResult.passed,
    constraintsUnlocked,
  };
}
