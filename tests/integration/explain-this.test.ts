// Integration test for "Explain This" feature (US11, T348)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DreyfusAssessment, Plan, Phase } from '../../src/types/domain.js';
import type { UserExplainData } from '../../src/types/websocket.js';

// ── Mock external dependencies ──────────────────────────────────────────────
//
// handleExplainThis calls callApi (Claude), getDatabase (to get DB handle),
// getAllDreyfus (Dreyfus assessments), getPlansBySession/getPhasesByPlan
// (active phase context), and logAction (action logging). All are mocked
// so tests never make real API calls or require a running database.

vi.mock('../../src/api-client/claude.js', () => ({
  callApi: vi.fn(),
}));

vi.mock('../../src/database/db.js', () => ({
  getDatabase: vi.fn(),
}));

vi.mock('../../src/database/queries/dreyfus.js', () => ({
  getAllDreyfus: vi.fn(),
}));

vi.mock('../../src/database/queries/plans.js', () => ({
  getPlansBySession: vi.fn(),
}));

vi.mock('../../src/database/queries/phases.js', () => ({
  getPhasesByPlan: vi.fn(),
}));

vi.mock('../../src/logger/action-log.js', () => ({
  logAction: vi.fn(),
}));

// ── Import modules under test AFTER mocking ────────────────────────────────

import { callApi } from '../../src/api-client/claude.js';
import { getDatabase, type AppDatabase } from '../../src/database/db.js';
import { getAllDreyfus } from '../../src/database/queries/dreyfus.js';
import { getPlansBySession } from '../../src/database/queries/plans.js';
import { getPhasesByPlan } from '../../src/database/queries/phases.js';
import { logAction } from '../../src/logger/action-log.js';
import { handleExplainThis } from '../../src/ui-apis/explain.js';

// ── Type-safe mock references ──────────────────────────────────────────────

const mockCallApi = vi.mocked(callApi);
const mockGetDatabase = vi.mocked(getDatabase);
const mockGetAllDreyfus = vi.mocked(getAllDreyfus);
const mockGetPlansBySession = vi.mocked(getPlansBySession);
const mockGetPhasesByPlan = vi.mocked(getPhasesByPlan);
const mockLogAction = vi.mocked(logAction);

// ── Fixtures ────────────────────────────────────────────────────────────────

/** Sentinel database object — mocked, never used for real queries. */
const fakeDb = {} as AppDatabase;

/** Default session ID for all tests. */
const SESSION_ID = 42;

/** Default explain request data. */
function defaultExplainData(): UserExplainData {
  return {
    path: 'src/utils/helpers.ts',
    range: { startLine: 10, endLine: 25 },
    selectedText:
      'function debounce(fn: Function, delay: number) {\n  let timer: NodeJS.Timeout;\n  return (...args: unknown[]) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), delay);\n  };\n}',
  };
}

/** Builds a Novice-level Dreyfus assessment. */
function noviceDreyfus(): DreyfusAssessment[] {
  return [
    {
      id: 1,
      skill_area: 'TypeScript',
      stage: 'Novice',
      confidence: 0.7,
      evidence: 'Struggles with generics and type narrowing',
      assessed_at: '2026-02-10T12:00:00.000Z',
    },
  ];
}

/** Builds an Expert-level Dreyfus assessment. */
function expertDreyfus(): DreyfusAssessment[] {
  return [
    {
      id: 2,
      skill_area: 'TypeScript',
      stage: 'Expert',
      confidence: 0.9,
      evidence: 'Demonstrates advanced type manipulation and architecture skills',
      assessed_at: '2026-02-10T12:00:00.000Z',
    },
  ];
}

/** Builds a mock plan with is_active = 1. */
function activePlan(): Plan {
  return {
    id: 1,
    session_id: SESSION_ID,
    title: 'Build a debounce utility',
    description: 'Create a reusable debounce function with TypeScript generics',
    total_phases: 3,
    created_at: '2026-02-10T12:00:00.000Z',
    is_active: 1,
  };
}

/** Builds a mock active phase. */
function activePhase(): Phase {
  return {
    id: 1,
    plan_id: 1,
    number: 2,
    title: 'Implement core logic',
    description: 'Write the debounce function with proper generic typing',
    hint_level: 'medium',
    status: 'active',
    started_at: '2026-02-10T13:00:00.000Z',
    completed_at: null,
  };
}

/** Default callApi response matching the expected Zod schema. */
function defaultApiResponse() {
  return {
    explanation: 'This is a debounce function that delays execution until a pause in calls.',
    phaseConnection:
      'This relates to the current phase where you are implementing core utility logic.',
  };
}

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('handleExplainThis (integration)', () => {
  beforeEach(() => {
    // Set up default mock return values for happy path
    mockGetDatabase.mockReturnValue(fakeDb);
    mockGetAllDreyfus.mockResolvedValue(noviceDreyfus());
    mockGetPlansBySession.mockResolvedValue([activePlan()]);
    mockGetPhasesByPlan.mockResolvedValue([
      { ...activePhase(), status: 'complete', number: 1, title: 'Setup' } as Phase,
      activePhase(),
      { ...activePhase(), status: 'pending', number: 3, title: 'Testing' } as Phase,
    ]);
    mockCallApi.mockResolvedValue(defaultApiResponse());
    mockLogAction.mockResolvedValue(undefined);
  });

  afterEach(() => {
    mockCallApi.mockReset();
    mockGetDatabase.mockReset();
    mockGetAllDreyfus.mockReset();
    mockGetPlansBySession.mockReset();
    mockGetPhasesByPlan.mockReset();
    mockLogAction.mockReset();
  });

  // ── Test 1: Basic happy path ────────────────────────────────────────────────

  it('returns explanation for selected code', async () => {
    const result = await handleExplainThis(defaultExplainData(), SESSION_ID);

    expect(result).toBeDefined();
    expect(result.explanation).toBe(
      'This is a debounce function that delays execution until a pause in calls.',
    );
    expect(result.phaseConnection).toBe(
      'This relates to the current phase where you are implementing core utility logic.',
    );
  });

  // ── Test 2: Novice Dreyfus context in system prompt ──────────────────────────

  it('includes Dreyfus context in system prompt for Novice', async () => {
    mockGetAllDreyfus.mockResolvedValue(noviceDreyfus());

    await handleExplainThis(defaultExplainData(), SESSION_ID);

    expect(mockCallApi).toHaveBeenCalledTimes(1);

    const callOptions = mockCallApi.mock.calls[0]![0];
    const systemPrompt = callOptions.systemPrompt.toLowerCase();

    // Novice prompt should mention high-level concepts and analogies
    expect(
      systemPrompt.includes('novice') ||
        systemPrompt.includes('high-level') ||
        systemPrompt.includes('analogies') ||
        systemPrompt.includes('beginner'),
    ).toBe(true);
  });

  // ── Test 3: Expert Dreyfus context in system prompt ──────────────────────────

  it('includes Dreyfus context in system prompt for Expert', async () => {
    mockGetAllDreyfus.mockResolvedValue(expertDreyfus());

    await handleExplainThis(defaultExplainData(), SESSION_ID);

    expect(mockCallApi).toHaveBeenCalledTimes(1);

    const callOptions = mockCallApi.mock.calls[0]![0];
    const systemPrompt = callOptions.systemPrompt.toLowerCase();

    // Expert prompt should mention architecture, trade-offs, or edge cases
    expect(
      systemPrompt.includes('expert') ||
        systemPrompt.includes('architecture') ||
        systemPrompt.includes('trade-off') ||
        systemPrompt.includes('edge case'),
    ).toBe(true);
  });

  // ── Test 4: Phase connection when active phase exists ─────────────────────────

  it('includes phase connection when active phase exists', async () => {
    mockGetPlansBySession.mockResolvedValue([activePlan()]);
    mockGetPhasesByPlan.mockResolvedValue([activePhase()]);
    mockCallApi.mockResolvedValue({
      explanation: 'A debounce utility.',
      phaseConnection: 'Directly relates to Phase 2: Implement core logic',
    });

    const result = await handleExplainThis(defaultExplainData(), SESSION_ID);

    expect(result.phaseConnection).not.toBeNull();
    expect(result.phaseConnection).toBe('Directly relates to Phase 2: Implement core logic');
  });

  // ── Test 5: Null phaseConnection when no active plan ──────────────────────────

  it('returns null phaseConnection when no active plan', async () => {
    mockGetPlansBySession.mockResolvedValue([]);
    mockCallApi.mockResolvedValue({
      explanation: 'A debounce function.',
      phaseConnection: undefined,
    });

    const result = await handleExplainThis(defaultExplainData(), SESSION_ID);

    expect(result.phaseConnection).toBeNull();
  });

  // ── Test 6: Null phaseConnection when no active phase ─────────────────────────

  it('returns null phaseConnection when no active phase', async () => {
    mockGetPlansBySession.mockResolvedValue([activePlan()]);
    // All phases are complete or pending — none active
    mockGetPhasesByPlan.mockResolvedValue([
      { ...activePhase(), status: 'complete', number: 1, title: 'Setup' } as Phase,
      { ...activePhase(), status: 'pending', number: 2, title: 'Core' } as Phase,
    ]);
    mockCallApi.mockResolvedValue({
      explanation: 'A debounce function.',
      phaseConnection: undefined,
    });

    const result = await handleExplainThis(defaultExplainData(), SESSION_ID);

    expect(result.phaseConnection).toBeNull();
  });

  // ── Test 7: callApi options ────────────────────────────────────────────────────

  it('calls callApi with explain_this callType and sonnet model', async () => {
    await handleExplainThis(defaultExplainData(), SESSION_ID);

    expect(mockCallApi).toHaveBeenCalledTimes(1);

    const callOptions = mockCallApi.mock.calls[0]![0];
    expect(callOptions.callType).toBe('explain_this');
    expect(callOptions.model).toBe('sonnet');
    expect(callOptions.sessionId).toBe(SESSION_ID);
  });

  // ── Test 8: Action logging ─────────────────────────────────────────────────────

  it('logs user_explain_request action', async () => {
    const data = defaultExplainData();

    await handleExplainThis(data, SESSION_ID);

    expect(mockLogAction).toHaveBeenCalledTimes(1);
    expect(mockLogAction).toHaveBeenCalledWith(
      fakeDb,
      SESSION_ID,
      'user_explain_request',
      expect.objectContaining({
        path: data.path,
      }),
    );
  });

  // ── Test 9: API failure propagation ────────────────────────────────────────────

  it('throws on API failure', async () => {
    mockCallApi.mockRejectedValue(new Error('Claude API unavailable'));

    await expect(handleExplainThis(defaultExplainData(), SESSION_ID)).rejects.toThrow(
      'Claude API unavailable',
    );
  });

  // ── Test 10: Empty Dreyfus assessments ──────────────────────────────────────────

  it('handles empty Dreyfus assessments', async () => {
    mockGetAllDreyfus.mockResolvedValue([]);

    const result = await handleExplainThis(defaultExplainData(), SESSION_ID);

    // Should still return a valid result even without Dreyfus data
    expect(result).toBeDefined();
    expect(result.explanation).toBeTruthy();
    expect(mockCallApi).toHaveBeenCalledTimes(1);
  });

  // ── Test 11: selectedText and path in user message ─────────────────────────────

  it('passes selectedText and path in user message', async () => {
    const data = defaultExplainData();

    await handleExplainThis(data, SESSION_ID);

    expect(mockCallApi).toHaveBeenCalledTimes(1);

    const callOptions = mockCallApi.mock.calls[0]![0];
    const userMessage = callOptions.userMessage;

    // Verify the user message contains the selected code and file path
    expect(userMessage).toContain(data.selectedText);
    expect(userMessage).toContain(data.path);
  });
});
