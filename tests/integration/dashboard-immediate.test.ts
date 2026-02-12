// Integration test for Dashboard Immediate Response (Flow 1 — state assembly)
// Tests assembleState() from src/dashboard/flows/state.ts
// Tests handleDashboardRequest() from src/dashboard/handler.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DreyfusAssessment } from '../../src/types/domain.js';

// ── Mock external dependencies ──────────────────────────────────────────────
//
// assembleState reads Dreyfus assessments from the DB and aggregates stats
// (session count, action count, API call count, total cost) filtered by period.
// handleDashboardRequest orchestrates all 4 flows, broadcasts state, and logs.

vi.mock('../../src/database/db.js', () => ({
  getDatabase: vi.fn(),
}));

vi.mock('../../src/database/queries/dreyfus.js', () => ({
  getAllDreyfus: vi.fn(),
}));

vi.mock('../../src/database/queries/actions.js', () => ({
  getActionsBySession: vi.fn(),
  getActionsByType: vi.fn(),
  getRecentActions: vi.fn(),
  getApiCallsBySession: vi.fn(),
  getApiCallStats: vi.fn(),
  getActionCountByPeriod: vi.fn(),
  getSessionCountByPeriod: vi.fn(),
}));

vi.mock('../../src/logger/api-log.js', () => ({
  logApiCall: vi.fn(),
  getSessionCost: vi.fn(),
  getApiCallCountByPeriod: vi.fn(),
  getApiCostByPeriod: vi.fn(),
}));

vi.mock('../../src/websocket/server.js', () => ({
  broadcast: vi.fn(),
}));

vi.mock('../../src/logger/action-log.js', () => ({
  logAction: vi.fn(),
}));

vi.mock('../../src/dashboard/flows/issues.js', () => ({
  assembleIssues: vi.fn(),
}));

vi.mock('../../src/dashboard/flows/challenges.js', () => ({
  assembleChallenges: vi.fn(),
}));

vi.mock('../../src/dashboard/flows/learning.js', () => ({
  assembleLearningMaterials: vi.fn(),
}));

vi.mock('../../src/mcp/session.js', () => ({
  getActiveSessionId: vi.fn(),
}));

// ── Import modules under test AFTER mocking ────────────────────────────────

import { getDatabase, type AppDatabase } from '../../src/database/db.js';
import { getAllDreyfus } from '../../src/database/queries/dreyfus.js';
import {
  getActionCountByPeriod,
  getSessionCountByPeriod,
} from '../../src/database/queries/actions.js';
import { getApiCallCountByPeriod, getApiCostByPeriod } from '../../src/logger/api-log.js';
import { broadcast } from '../../src/websocket/server.js';
import { logAction } from '../../src/logger/action-log.js';
import { assembleIssues } from '../../src/dashboard/flows/issues.js';
import { assembleChallenges } from '../../src/dashboard/flows/challenges.js';
import { assembleLearningMaterials } from '../../src/dashboard/flows/learning.js';
import { getActiveSessionId } from '../../src/mcp/session.js';
import { assembleState } from '../../src/dashboard/flows/state.js';
import { handleDashboardRequest } from '../../src/dashboard/handler.js';

// ── Type-safe mock references ──────────────────────────────────────────────

const mockGetDatabase = vi.mocked(getDatabase);
const mockGetAllDreyfus = vi.mocked(getAllDreyfus);
const mockGetActionCountByPeriod = vi.mocked(getActionCountByPeriod);
const mockGetSessionCountByPeriod = vi.mocked(getSessionCountByPeriod);
const mockGetApiCallCountByPeriod = vi.mocked(getApiCallCountByPeriod);
const mockGetApiCostByPeriod = vi.mocked(getApiCostByPeriod);
const mockBroadcast = vi.mocked(broadcast);
const mockLogAction = vi.mocked(logAction);
const mockAssembleIssues = vi.mocked(assembleIssues);
const mockAssembleChallenges = vi.mocked(assembleChallenges);
const mockAssembleLearningMaterials = vi.mocked(assembleLearningMaterials);
const mockGetActiveSessionId = vi.mocked(getActiveSessionId);

// ── Fixtures ────────────────────────────────────────────────────────────────

/** Sentinel database object — mocked, never used for real queries. */
const fakeDb = {} as AppDatabase;

/** Builds sample Dreyfus assessments. */
function sampleDreyfusAssessments(): DreyfusAssessment[] {
  return [
    {
      id: 1,
      skill_area: 'TypeScript',
      stage: 'Competent',
      confidence: 0.8,
      evidence: 'Demonstrates solid understanding of generics and type narrowing',
      assessed_at: '2026-02-10T12:00:00.000Z',
    },
    {
      id: 2,
      skill_area: 'Testing',
      stage: 'Advanced Beginner',
      confidence: 0.6,
      evidence: 'Writes basic unit tests but struggles with mocking',
      assessed_at: '2026-02-10T12:00:00.000Z',
    },
  ];
}

// ── Test Suite: assembleState ───────────────────────────────────────────────

describe('assembleState (Dashboard Flow 1)', () => {
  beforeEach(() => {
    mockGetDatabase.mockReturnValue(fakeDb);
    mockGetAllDreyfus.mockResolvedValue(sampleDreyfusAssessments());
    mockGetSessionCountByPeriod.mockResolvedValue(5);
    mockGetActionCountByPeriod.mockResolvedValue(120);
    mockGetApiCallCountByPeriod.mockResolvedValue(30);
    mockGetApiCostByPeriod.mockResolvedValue(1.45);
    mockLogAction.mockResolvedValue(undefined);
    mockGetActiveSessionId.mockReturnValue(42);
  });

  afterEach(() => {
    mockGetDatabase.mockReset();
    mockGetAllDreyfus.mockReset();
    mockGetSessionCountByPeriod.mockReset();
    mockGetActionCountByPeriod.mockReset();
    mockGetApiCallCountByPeriod.mockReset();
    mockGetApiCostByPeriod.mockReset();
    mockLogAction.mockReset();
    mockGetActiveSessionId.mockReset();
  });

  // ── Test 1: Dreyfus assessments mapped to DreyfusAssessmentEntry format ─────

  it('returns Dreyfus assessments mapped to DreyfusAssessmentEntry format', async () => {
    const result = await assembleState('all');

    expect(result.dreyfus).toHaveLength(2);
    expect(result.dreyfus[0]).toEqual({
      skill_area: 'TypeScript',
      stage: 'Competent',
      confidence: 0.8,
    });
    expect(result.dreyfus[1]).toEqual({
      skill_area: 'Testing',
      stage: 'Advanced Beginner',
      confidence: 0.6,
    });
  });

  // ── Test 2: Returns stats with totals ──────────────────────────────────────────

  it('returns stats with total_sessions, total_actions, total_api_calls, total_cost', async () => {
    const result = await assembleState('all');

    expect(result.stats).toEqual({
      total_sessions: 5,
      total_actions: 120,
      total_api_calls: 30,
      total_cost: 1.45,
    });
  });

  // ── Test 3: Placeholder empty arrays for issues, challenges, learning_materials ─

  it('returns empty arrays for issues, challenges, and learning_materials', async () => {
    const result = await assembleState('all');

    expect(result.issues).toEqual([]);
    expect(result.challenges).toEqual([]);
    expect(result.learning_materials).toEqual([]);
  });

  // ── Test 4: Filters stats by "7d" period ─────────────────────────────────────

  it('filters stats by "7d" period', async () => {
    mockGetSessionCountByPeriod.mockResolvedValue(2);
    mockGetActionCountByPeriod.mockResolvedValue(40);
    mockGetApiCallCountByPeriod.mockResolvedValue(10);
    mockGetApiCostByPeriod.mockResolvedValue(0.5);

    const result = await assembleState('7d');

    expect(result.stats).toEqual({
      total_sessions: 2,
      total_actions: 40,
      total_api_calls: 10,
      total_cost: 0.5,
    });

    // Verify period was passed through to query functions
    expect(mockGetSessionCountByPeriod).toHaveBeenCalledWith(fakeDb, '7d');
    expect(mockGetActionCountByPeriod).toHaveBeenCalledWith(fakeDb, '7d');
    expect(mockGetApiCallCountByPeriod).toHaveBeenCalledWith(fakeDb, '7d');
    expect(mockGetApiCostByPeriod).toHaveBeenCalledWith(fakeDb, '7d');
  });

  // ── Test 5: Filters stats by "30d" period ────────────────────────────────────

  it('filters stats by "30d" period', async () => {
    mockGetSessionCountByPeriod.mockResolvedValue(4);
    mockGetActionCountByPeriod.mockResolvedValue(95);
    mockGetApiCallCountByPeriod.mockResolvedValue(22);
    mockGetApiCostByPeriod.mockResolvedValue(1.1);

    const result = await assembleState('30d');

    expect(result.stats).toEqual({
      total_sessions: 4,
      total_actions: 95,
      total_api_calls: 22,
      total_cost: 1.1,
    });

    expect(mockGetSessionCountByPeriod).toHaveBeenCalledWith(fakeDb, '30d');
    expect(mockGetActionCountByPeriod).toHaveBeenCalledWith(fakeDb, '30d');
    expect(mockGetApiCallCountByPeriod).toHaveBeenCalledWith(fakeDb, '30d');
    expect(mockGetApiCostByPeriod).toHaveBeenCalledWith(fakeDb, '30d');
  });

  // ── Test 6: "all" period includes everything ────────────────────────────────

  it('"all" period includes everything', async () => {
    const result = await assembleState('all');

    expect(result.stats.total_sessions).toBe(5);
    expect(result.stats.total_actions).toBe(120);
    expect(result.stats.total_api_calls).toBe(30);
    expect(result.stats.total_cost).toBe(1.45);

    expect(mockGetSessionCountByPeriod).toHaveBeenCalledWith(fakeDb, 'all');
    expect(mockGetActionCountByPeriod).toHaveBeenCalledWith(fakeDb, 'all');
    expect(mockGetApiCallCountByPeriod).toHaveBeenCalledWith(fakeDb, 'all');
    expect(mockGetApiCostByPeriod).toHaveBeenCalledWith(fakeDb, 'all');
  });

  // ── Test 7: Fresh install with no data ──────────────────────────────────────

  it('fresh install with no data returns zeros and empty arrays', async () => {
    mockGetAllDreyfus.mockResolvedValue([]);
    mockGetSessionCountByPeriod.mockResolvedValue(0);
    mockGetActionCountByPeriod.mockResolvedValue(0);
    mockGetApiCallCountByPeriod.mockResolvedValue(0);
    mockGetApiCostByPeriod.mockResolvedValue(0);

    const result = await assembleState('all');

    expect(result.dreyfus).toEqual([]);
    expect(result.stats).toEqual({
      total_sessions: 0,
      total_actions: 0,
      total_api_calls: 0,
      total_cost: 0,
    });
    expect(result.issues).toEqual([]);
    expect(result.challenges).toEqual([]);
    expect(result.learning_materials).toEqual([]);
  });

  // ── Test 8: All stats are non-negative ────────────────────────────────────────

  it('returns valid data with all stats >= 0', async () => {
    const result = await assembleState('7d');

    expect(result.stats.total_sessions).toBeGreaterThanOrEqual(0);
    expect(result.stats.total_actions).toBeGreaterThanOrEqual(0);
    expect(result.stats.total_api_calls).toBeGreaterThanOrEqual(0);
    expect(result.stats.total_cost).toBeGreaterThanOrEqual(0);
  });
});

// ── Test Suite: handleDashboardRequest ──────────────────────────────────────

describe('handleDashboardRequest (integration)', () => {
  beforeEach(() => {
    mockGetDatabase.mockReturnValue(fakeDb);
    mockGetAllDreyfus.mockResolvedValue(sampleDreyfusAssessments());
    mockGetSessionCountByPeriod.mockResolvedValue(5);
    mockGetActionCountByPeriod.mockResolvedValue(120);
    mockGetApiCallCountByPeriod.mockResolvedValue(30);
    mockGetApiCostByPeriod.mockResolvedValue(1.45);
    mockLogAction.mockResolvedValue(undefined);
    mockGetActiveSessionId.mockReturnValue(42);
    mockAssembleIssues.mockResolvedValue({ issues: [] });
    mockAssembleChallenges.mockResolvedValue({ challenges: [] });
    mockAssembleLearningMaterials.mockResolvedValue({ materials: [] });
  });

  afterEach(() => {
    mockGetDatabase.mockReset();
    mockGetAllDreyfus.mockReset();
    mockGetSessionCountByPeriod.mockReset();
    mockGetActionCountByPeriod.mockReset();
    mockGetApiCallCountByPeriod.mockReset();
    mockGetApiCostByPeriod.mockReset();
    mockBroadcast.mockReset();
    mockLogAction.mockReset();
    mockGetActiveSessionId.mockReset();
    mockAssembleIssues.mockReset();
    mockAssembleChallenges.mockReset();
    mockAssembleLearningMaterials.mockReset();
  });

  // ── Test 9: Broadcasts dashboard:state immediately ─────────────────────────

  it('broadcasts dashboard:state immediately', async () => {
    await handleDashboardRequest('7d');

    // First broadcast should be dashboard:state (Flow 1 runs before Flows 2-4)
    expect(mockBroadcast).toHaveBeenCalled();
    const firstCall = mockBroadcast.mock.calls[0]![0] as {
      type: string;
      data: { dreyfus: unknown[]; stats: Record<string, number> };
    };
    expect(firstCall.type).toBe('dashboard:state');
    expect(Array.isArray(firstCall.data.dreyfus)).toBe(true);
    expect(typeof firstCall.data.stats['total_sessions']).toBe('number');
    expect(typeof firstCall.data.stats['total_actions']).toBe('number');
    expect(typeof firstCall.data.stats['total_api_calls']).toBe('number');
    expect(typeof firstCall.data.stats['total_cost']).toBe('number');
  });

  // ── Test 10: Returns flowsCompleted with per-flow status booleans ──────────

  it('returns flowsCompleted with per-flow status booleans', async () => {
    const result = await handleDashboardRequest('all');

    expect(result.flowsCompleted).toBeDefined();
    expect(typeof result.flowsCompleted.state).toBe('boolean');
    expect(typeof result.flowsCompleted.issues).toBe('boolean');
    expect(typeof result.flowsCompleted.challenges).toBe('boolean');
    expect(typeof result.flowsCompleted.learning_materials).toBe('boolean');
  });

  // ── Test 11: Calls assembleState with the provided statsPeriod ──────────────

  it('calls assembleState with the provided statsPeriod', async () => {
    await handleDashboardRequest('30d');

    // assembleState queries stats by period — verify the period was forwarded
    expect(mockGetSessionCountByPeriod).toHaveBeenCalledWith(fakeDb, '30d');
    expect(mockGetActionCountByPeriod).toHaveBeenCalledWith(fakeDb, '30d');
    expect(mockGetApiCallCountByPeriod).toHaveBeenCalledWith(fakeDb, '30d');
    expect(mockGetApiCostByPeriod).toHaveBeenCalledWith(fakeDb, '30d');
  });

  // ── Test 12: Logs dashboard_loaded action with flow statuses ──────────────

  it('logs dashboard_loaded action with flow statuses', async () => {
    await handleDashboardRequest('7d');

    expect(mockLogAction).toHaveBeenCalledTimes(1);
    const logArgs = mockLogAction.mock.calls[0]!;
    expect(logArgs[2]).toBe('dashboard_loaded');
    const flowData = logArgs[3] as Record<string, boolean>;
    expect(typeof flowData['state']).toBe('boolean');
    expect(typeof flowData['issues']).toBe('boolean');
    expect(typeof flowData['challenges']).toBe('boolean');
    expect(typeof flowData['learning_materials']).toBe('boolean');
  });
});
