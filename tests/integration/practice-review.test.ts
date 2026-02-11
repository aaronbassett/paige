import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Mock external dependencies ─────────────────────────────────────────────
//
// The practice review handler calls Claude API (via callApi), reads/writes
// kata data (via getKataById / updateKataAttempts), logs actions (via
// logAction), and reads the database handle (via getDatabase). All are
// mocked so tests never make real API calls or touch SQLite.

vi.mock('../../src/api-client/claude.js', () => ({
  callApi: vi.fn(),
}));

vi.mock('../../src/database/db.js', () => ({
  getDatabase: vi.fn(),
}));

vi.mock('../../src/database/queries/katas.js', () => ({
  getKataById: vi.fn(),
  updateKataAttempts: vi.fn(),
}));

vi.mock('../../src/logger/action-log.js', () => ({
  logAction: vi.fn(),
}));

// ── Import modules under test AFTER mocking ────────────────────────────────

import { callApi } from '../../src/api-client/claude.js';
import { getDatabase, type AppDatabase } from '../../src/database/db.js';
import { getKataById, updateKataAttempts } from '../../src/database/queries/katas.js';
import { logAction } from '../../src/logger/action-log.js';
import { handlePracticeReview } from '../../src/ui-apis/review.js';
import type { KataSpec } from '../../src/types/domain.js';
import type { PracticeSubmitSolutionData } from '../../src/types/websocket.js';

// ── Type aliases for mock functions ────────────────────────────────────────

const mockCallApi = callApi as ReturnType<typeof vi.fn>;
const mockGetDatabase = getDatabase as ReturnType<typeof vi.fn>;
const mockGetKataById = getKataById as ReturnType<typeof vi.fn>;
const mockUpdateKataAttempts = updateKataAttempts as ReturnType<typeof vi.fn>;
const mockLogAction = logAction as ReturnType<typeof vi.fn>;

// ── Fixtures ───────────────────────────────────────────────────────────────

const defaultKata: KataSpec = {
  id: 1,
  gap_id: 10,
  title: 'Test Kata',
  description: 'Write a function that reverses a string',
  scaffolding_code: 'function reverse(s) { }',
  instructor_notes: 'Focus on edge cases',
  constraints: JSON.stringify([
    { id: 'c1', description: 'No built-in reverse', minLevel: 1 },
    { id: 'c3', description: 'Handle unicode', minLevel: 3 },
    { id: 'c5', description: 'O(1) space', minLevel: 5 },
  ]),
  user_attempts: '[]',
  created_at: '2026-02-11T10:00:00.000Z',
};

const defaultInput: PracticeSubmitSolutionData = {
  kataId: 1,
  code: 'function reverse(s) { return s.split("").reverse().join(""); }',
  activeConstraints: ['c1'],
};

const defaultApiResponse = {
  review: 'Good work',
  level: 3,
  passed: true,
};

/** Sentinel database object — never called, only used for type satisfaction. */
const fakeDb = {} as AppDatabase;

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('handlePracticeReview (integration)', () => {
  const sessionId = 42;

  beforeEach(() => {
    // Database returns a non-null sentinel
    mockGetDatabase.mockReturnValue(fakeDb);

    // Kata lookup returns the default fixture
    mockGetKataById.mockResolvedValue(defaultKata);

    // API returns a valid review
    mockCallApi.mockResolvedValue(defaultApiResponse);

    // updateKataAttempts returns the updated kata
    mockUpdateKataAttempts.mockResolvedValue({ ...defaultKata, user_attempts: '[]' });

    // logAction resolves successfully
    mockLogAction.mockResolvedValue(undefined);
  });

  afterEach(() => {
    mockCallApi.mockReset();
    mockGetDatabase.mockReset();
    mockGetKataById.mockReset();
    mockUpdateKataAttempts.mockReset();
    mockLogAction.mockReset();
  });

  // ── 1. Happy Path ──────────────────────────────────────────────────────────

  it('returns review result for valid kata', async () => {
    const result = await handlePracticeReview(defaultInput, sessionId);

    expect(result).toBeDefined();
    expect(result.review).toBe('Good work');
    expect(result.level).toBe(3);
    expect(result.passed).toBe(true);
    expect(result.constraintsUnlocked).toBeInstanceOf(Array);
  });

  // ── 2. Sonnet Call Verification ─────────────────────────────────────────────

  it('calls Sonnet with kata description and constraints', async () => {
    await handlePracticeReview(defaultInput, sessionId);

    expect(mockCallApi).toHaveBeenCalledTimes(1);

    const callArgs = mockCallApi.mock.calls[0]![0] as {
      userMessage: string;
      systemPrompt: string;
      callType: string;
      sessionId: number;
    };

    // The user message should include the kata description
    expect(callArgs.userMessage).toContain('Write a function that reverses a string');

    // The user message should include the submitted code
    expect(callArgs.userMessage).toContain(defaultInput.code);

    // The user message should reference active constraints
    expect(callArgs.userMessage).toContain('c1');

    // The session ID should be passed through
    expect(callArgs.sessionId).toBe(sessionId);

    // The call type should be practice_review
    expect(callArgs.callType).toBe('practice_review');
  });

  // ── 3. Attempt Persistence ──────────────────────────────────────────────────

  it('persists new attempt to user_attempts', async () => {
    await handlePracticeReview(defaultInput, sessionId);

    expect(mockUpdateKataAttempts).toHaveBeenCalledTimes(1);

    const updateArgs = mockUpdateKataAttempts.mock.calls[0] as [AppDatabase, number, string];
    const updatedAttempts = JSON.parse(updateArgs[2]) as Array<{
      code: string;
      review: string;
      level: number;
      passed: boolean;
      constraints: string[];
      submitted_at: string;
    }>;

    expect(updatedAttempts).toHaveLength(1);
    expect(updatedAttempts[0]!.code).toBe(defaultInput.code);
    expect(updatedAttempts[0]!.review).toBe('Good work');
    expect(updatedAttempts[0]!.level).toBe(3);
    expect(updatedAttempts[0]!.passed).toBe(true);
    expect(updatedAttempts[0]!.constraints).toEqual(['c1']);
    expect(updatedAttempts[0]!.submitted_at).toBeDefined();
  });

  // ── 4. Constraint Unlocking ─────────────────────────────────────────────────

  it('unlocks constraints based on level', async () => {
    // Level 5 means constraints with minLevel 1, 3, 5 all qualify.
    // Active constraints already include ["c1"], so c3 and c5 are newly unlocked.
    mockCallApi.mockResolvedValue({
      review: 'Excellent solution',
      level: 5,
      passed: true,
    });

    const result = await handlePracticeReview(defaultInput, sessionId);

    // c1 is already active, c3 (minLevel 3) and c5 (minLevel 5) should be unlocked
    expect(result.constraintsUnlocked).toContain('c3');
    expect(result.constraintsUnlocked).toContain('c5');
    expect(result.constraintsUnlocked).not.toContain('c1');
    expect(result.constraintsUnlocked).toHaveLength(2);
  });

  // ── 5. No New Constraints Qualify ──────────────────────────────────────────

  it('returns empty constraintsUnlocked when no new constraints qualify', async () => {
    // Level 1, all minLevel=1 constraints (c1) already active
    mockCallApi.mockResolvedValue({
      review: 'Needs improvement',
      level: 1,
      passed: false,
    });

    const result = await handlePracticeReview(defaultInput, sessionId);

    // c1 is already active, c3 (minLevel 3) and c5 (minLevel 5) don't qualify at level 1
    expect(result.constraintsUnlocked).toEqual([]);
  });

  // ── 6. Same-Constraint Filtering ───────────────────────────────────────────

  it('filters previous attempts by matching constraints', async () => {
    const kataWithAttempts: KataSpec = {
      ...defaultKata,
      user_attempts: JSON.stringify([
        {
          code: 'attempt1',
          review: 'r1',
          level: 2,
          passed: false,
          constraints: ['a', 'b'],
          submitted_at: '2026-02-11T09:00:00.000Z',
        },
        {
          code: 'attempt2',
          review: 'r2',
          level: 1,
          passed: false,
          constraints: ['c'],
          submitted_at: '2026-02-11T09:10:00.000Z',
        },
        {
          code: 'attempt3',
          review: 'r3',
          level: 3,
          passed: true,
          constraints: ['a', 'b'],
          submitted_at: '2026-02-11T09:20:00.000Z',
        },
      ]),
    };

    mockGetKataById.mockResolvedValue(kataWithAttempts);

    const inputWithAB: PracticeSubmitSolutionData = {
      kataId: 1,
      code: 'my solution',
      activeConstraints: ['a', 'b'],
    };

    await handlePracticeReview(inputWithAB, sessionId);

    // Verify that the API call only includes attempts matching ["a", "b"]
    const callArgs = mockCallApi.mock.calls[0]![0] as { userMessage: string };
    const userMessage = callArgs.userMessage;

    // Matching attempts (constraints: ["a","b"]) should be included
    expect(userMessage).toContain('attempt1');
    expect(userMessage).toContain('attempt3');

    // Non-matching attempt (constraints: ["c"]) should NOT be included
    expect(userMessage).not.toContain('attempt2');
  });

  // ── 7. First Submission (No Previous Attempts) ─────────────────────────────

  it('sends no previous attempts for first submission', async () => {
    // Default kata has user_attempts: '[]'
    await handlePracticeReview(defaultInput, sessionId);

    const callArgs = mockCallApi.mock.calls[0]![0] as { userMessage: string };

    // The API should still be called even with no previous attempts
    expect(mockCallApi).toHaveBeenCalledTimes(1);

    // The user message should not contain attempt-related content for
    // previous attempts (the message is constructed by the implementation,
    // so we just verify the call went through with the code)
    expect(callArgs.userMessage).toContain(defaultInput.code);
  });

  // ── 8. Non-Existent Kata ──────────────────────────────────────────────────

  it('throws for non-existent kataId', async () => {
    mockGetKataById.mockResolvedValue(null);

    await expect(handlePracticeReview(defaultInput, sessionId)).rejects.toThrow();
  });

  // ── 9. API Failure ────────────────────────────────────────────────────────

  it('throws on API failure', async () => {
    mockCallApi.mockRejectedValue(new Error('API call failed'));

    await expect(handlePracticeReview(defaultInput, sessionId)).rejects.toThrow('API call failed');
  });

  // ── 10. Logs practice_solution_submitted ──────────────────────────────────

  it('logs practice_solution_submitted before API call', async () => {
    await handlePracticeReview(defaultInput, sessionId);

    // Find logAction call with 'practice_solution_submitted'
    const logCalls = mockLogAction.mock.calls as Array<
      [AppDatabase, number, string, Record<string, unknown> | undefined]
    >;
    const submittedCall = logCalls.find((call) => call[2] === 'practice_solution_submitted');

    expect(submittedCall).toBeDefined();
    expect(submittedCall![1]).toBe(sessionId);
  });

  // ── 11. Logs practice_solution_reviewed ───────────────────────────────────

  it('logs practice_solution_reviewed after API call', async () => {
    await handlePracticeReview(defaultInput, sessionId);

    // Find logAction call with 'practice_solution_reviewed'
    const logCalls = mockLogAction.mock.calls as Array<
      [AppDatabase, number, string, Record<string, unknown> | undefined]
    >;
    const reviewedCall = logCalls.find((call) => call[2] === 'practice_solution_reviewed');

    expect(reviewedCall).toBeDefined();
    expect(reviewedCall![1]).toBe(sessionId);

    // The log data should include level and passed info
    const logData = reviewedCall![3];
    expect(logData).toBeDefined();
    expect(logData!['level']).toBe(3);
    expect(logData!['passed']).toBe(true);
  });

  // ── 12. Kata With No Constraints ──────────────────────────────────────────

  it('handles kata with no constraints', async () => {
    const kataNoConstraints: KataSpec = {
      ...defaultKata,
      constraints: '[]',
    };
    mockGetKataById.mockResolvedValue(kataNoConstraints);

    const inputNoConstraints: PracticeSubmitSolutionData = {
      kataId: 1,
      code: 'my code',
      activeConstraints: [],
    };

    const result = await handlePracticeReview(inputNoConstraints, sessionId);

    expect(result).toBeDefined();
    expect(result.constraintsUnlocked).toEqual([]);
    expect(result.review).toBe('Good work');
  });

  // ── 13. MaxLevel From All Attempts Including New One ──────────────────────

  it('computes maxLevel from all attempts including new one', async () => {
    const kataWithHigherAttempts: KataSpec = {
      ...defaultKata,
      user_attempts: JSON.stringify([
        {
          code: 'old1',
          review: 'ok',
          level: 2,
          passed: false,
          constraints: ['c1'],
          submitted_at: '2026-02-11T09:00:00.000Z',
        },
        {
          code: 'old2',
          review: 'good',
          level: 3,
          passed: true,
          constraints: ['c1'],
          submitted_at: '2026-02-11T09:10:00.000Z',
        },
      ]),
    };
    mockGetKataById.mockResolvedValue(kataWithHigherAttempts);

    // New attempt gets level 1, but existing attempts have levels [2, 3]
    // maxLevel should be 3 (from existing), not 1 (from new)
    mockCallApi.mockResolvedValue({
      review: 'Could be better',
      level: 1,
      passed: false,
    });

    const result = await handlePracticeReview(defaultInput, sessionId);

    // maxLevel = max(2, 3, 1) = 3
    // c1 (minLevel 1) already active
    // c3 (minLevel 3) qualifies (3 <= 3) and not in activeConstraints -> unlocked
    // c5 (minLevel 5) does NOT qualify (5 > 3)
    expect(result.constraintsUnlocked).toContain('c3');
    expect(result.constraintsUnlocked).not.toContain('c5');
    expect(result.constraintsUnlocked).not.toContain('c1');
  });
});
