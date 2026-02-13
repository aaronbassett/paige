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
  assembleAndStreamIssues: vi.fn(),
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
import { assembleAndStreamIssues } from '../../src/dashboard/flows/issues.js';
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
const mockAssembleAndStreamIssues = vi.mocked(assembleAndStreamIssues);
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
    const result = await assembleState('all_time');

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

  // ── Test 2: Returns stats in DashboardStatsData format ──────────────────────

  it('returns stats in DashboardStatsData format with period and stat payloads', async () => {
    const result = await assembleState('all_time');

    expect(result.stats.period).toBe('all_time');
    expect(result.stats.stats.sessions).toEqual({ value: 5, change: 0, unit: 'count' });
    expect(result.stats.stats.actions).toEqual({ value: 120, change: 0, unit: 'count' });
    expect(result.stats.stats.api_calls).toEqual({ value: 30, change: 0, unit: 'count' });
    expect(result.stats.stats.total_cost).toEqual({ value: 1.45, change: 0, unit: 'currency' });
  });

  // ── Test 3: Placeholder empty arrays for issues, challenges, learning_materials ─

  it('returns empty arrays for issues, challenges, and learning_materials', async () => {
    const result = await assembleState('all_time');

    expect(result.issues).toEqual([]);
    expect(result.challenges).toEqual([]);
    expect(result.learning_materials).toEqual([]);
  });

  // ── Test 4: Filters stats by "last_week" period ─────────────────────────────

  it('filters stats by "last_week" period', async () => {
    mockGetSessionCountByPeriod.mockResolvedValue(2);
    mockGetActionCountByPeriod.mockResolvedValue(40);
    mockGetApiCallCountByPeriod.mockResolvedValue(10);
    mockGetApiCostByPeriod.mockResolvedValue(0.5);

    const result = await assembleState('last_week');

    expect(result.stats.period).toBe('last_week');
    expect(result.stats.stats.sessions).toEqual({ value: 2, change: 0, unit: 'count' });
    expect(result.stats.stats.actions).toEqual({ value: 40, change: 0, unit: 'count' });
    expect(result.stats.stats.api_calls).toEqual({ value: 10, change: 0, unit: 'count' });
    expect(result.stats.stats.total_cost).toEqual({ value: 0.5, change: 0, unit: 'currency' });

    // Verify period was passed through to query functions
    expect(mockGetSessionCountByPeriod).toHaveBeenCalledWith(fakeDb, 'last_week');
    expect(mockGetActionCountByPeriod).toHaveBeenCalledWith(fakeDb, 'last_week');
    expect(mockGetApiCallCountByPeriod).toHaveBeenCalledWith(fakeDb, 'last_week');
    expect(mockGetApiCostByPeriod).toHaveBeenCalledWith(fakeDb, 'last_week');
  });

  // ── Test 5: Filters stats by "last_month" period ────────────────────────────

  it('filters stats by "last_month" period', async () => {
    mockGetSessionCountByPeriod.mockResolvedValue(4);
    mockGetActionCountByPeriod.mockResolvedValue(95);
    mockGetApiCallCountByPeriod.mockResolvedValue(22);
    mockGetApiCostByPeriod.mockResolvedValue(1.1);

    const result = await assembleState('last_month');

    expect(result.stats.period).toBe('last_month');
    expect(result.stats.stats.sessions).toEqual({ value: 4, change: 0, unit: 'count' });
    expect(result.stats.stats.actions).toEqual({ value: 95, change: 0, unit: 'count' });
    expect(result.stats.stats.api_calls).toEqual({ value: 22, change: 0, unit: 'count' });
    expect(result.stats.stats.total_cost).toEqual({ value: 1.1, change: 0, unit: 'currency' });

    expect(mockGetSessionCountByPeriod).toHaveBeenCalledWith(fakeDb, 'last_month');
    expect(mockGetActionCountByPeriod).toHaveBeenCalledWith(fakeDb, 'last_month');
    expect(mockGetApiCallCountByPeriod).toHaveBeenCalledWith(fakeDb, 'last_month');
    expect(mockGetApiCostByPeriod).toHaveBeenCalledWith(fakeDb, 'last_month');
  });

  // ── Test 6: "all_time" period includes everything ────────────────────────────

  it('"all_time" period includes everything', async () => {
    const result = await assembleState('all_time');

    expect(result.stats.stats.sessions?.value).toBe(5);
    expect(result.stats.stats.actions?.value).toBe(120);
    expect(result.stats.stats.api_calls?.value).toBe(30);
    expect(result.stats.stats.total_cost?.value).toBe(1.45);

    expect(mockGetSessionCountByPeriod).toHaveBeenCalledWith(fakeDb, 'all_time');
    expect(mockGetActionCountByPeriod).toHaveBeenCalledWith(fakeDb, 'all_time');
    expect(mockGetApiCallCountByPeriod).toHaveBeenCalledWith(fakeDb, 'all_time');
    expect(mockGetApiCostByPeriod).toHaveBeenCalledWith(fakeDb, 'all_time');
  });

  // ── Test 7: Fresh install with no data ──────────────────────────────────────

  it('fresh install with no data returns zeros and empty arrays', async () => {
    mockGetAllDreyfus.mockResolvedValue([]);
    mockGetSessionCountByPeriod.mockResolvedValue(0);
    mockGetActionCountByPeriod.mockResolvedValue(0);
    mockGetApiCallCountByPeriod.mockResolvedValue(0);
    mockGetApiCostByPeriod.mockResolvedValue(0);

    const result = await assembleState('all_time');

    expect(result.dreyfus).toEqual([]);
    expect(result.stats.period).toBe('all_time');
    expect(result.stats.stats.sessions).toEqual({ value: 0, change: 0, unit: 'count' });
    expect(result.stats.stats.actions).toEqual({ value: 0, change: 0, unit: 'count' });
    expect(result.stats.stats.api_calls).toEqual({ value: 0, change: 0, unit: 'count' });
    expect(result.stats.stats.total_cost).toEqual({ value: 0, change: 0, unit: 'currency' });
    expect(result.issues).toEqual([]);
    expect(result.challenges).toEqual([]);
    expect(result.learning_materials).toEqual([]);
  });

  // ── Test 8: All stats are non-negative ────────────────────────────────────────

  it('returns valid data with all stat values >= 0', async () => {
    const result = await assembleState('last_week');

    expect(result.stats.stats.sessions?.value).toBeGreaterThanOrEqual(0);
    expect(result.stats.stats.actions?.value).toBeGreaterThanOrEqual(0);
    expect(result.stats.stats.api_calls?.value).toBeGreaterThanOrEqual(0);
    expect(result.stats.stats.total_cost?.value).toBeGreaterThanOrEqual(0);
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
    mockAssembleAndStreamIssues.mockResolvedValue(undefined);
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
    mockAssembleAndStreamIssues.mockReset();
    mockAssembleChallenges.mockReset();
    mockAssembleLearningMaterials.mockReset();
  });

  // ── Test 9: Broadcasts dashboard:dreyfus and dashboard:stats immediately ────

  it('broadcasts dashboard:dreyfus and dashboard:stats immediately', async () => {
    await handleDashboardRequest('last_week', 'test-conn-id', 'owner', 'repo');

    // Flow 1 broadcasts dreyfus + stats before Flows 2-4 start
    expect(mockBroadcast).toHaveBeenCalled();
    const firstCall = mockBroadcast.mock.calls[0]![0] as {
      type: string;
      data: { axes: unknown[] };
    };
    expect(firstCall.type).toBe('dashboard:dreyfus');
    expect(Array.isArray(firstCall.data.axes)).toBe(true);

    const secondCall = mockBroadcast.mock.calls[1]![0] as {
      type: string;
      data: { period: string; stats: Record<string, unknown> };
    };
    expect(secondCall.type).toBe('dashboard:stats');
    expect(typeof secondCall.data.stats).toBe('object');
  });

  // ── Test 10: Returns flowsCompleted with per-flow status booleans ──────────

  it('returns flowsCompleted with per-flow status booleans', async () => {
    const result = await handleDashboardRequest('all_time', 'test-conn-id', 'owner', 'repo');

    expect(result.flowsCompleted).toBeDefined();
    expect(typeof result.flowsCompleted.state).toBe('boolean');
    expect(typeof result.flowsCompleted.issues).toBe('boolean');
    expect(typeof result.flowsCompleted.challenges).toBe('boolean');
    expect(typeof result.flowsCompleted.learning_materials).toBe('boolean');
  });

  // ── Test 11: Calls assembleState with the provided statsPeriod ──────────────

  it('calls assembleState with the provided statsPeriod', async () => {
    await handleDashboardRequest('last_month', 'test-conn-id', 'owner', 'repo');

    // assembleState queries stats by period — verify the period was forwarded
    expect(mockGetSessionCountByPeriod).toHaveBeenCalledWith(fakeDb, 'last_month');
    expect(mockGetActionCountByPeriod).toHaveBeenCalledWith(fakeDb, 'last_month');
    expect(mockGetApiCallCountByPeriod).toHaveBeenCalledWith(fakeDb, 'last_month');
    expect(mockGetApiCostByPeriod).toHaveBeenCalledWith(fakeDb, 'last_month');
  });

  // ── Test 12: Logs dashboard_loaded action with flow statuses ──────────────

  it('logs dashboard_loaded action with flow statuses', async () => {
    await handleDashboardRequest('last_week', 'test-conn-id', 'owner', 'repo');

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
