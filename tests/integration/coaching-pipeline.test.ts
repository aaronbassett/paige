import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ── Mock external dependencies ─────────────────────────────────────────────
//
// The coaching pipeline calls Claude API (via callApi), queries ChromaDB
// memories (via queryMemories), and broadcasts WebSocket messages (via
// broadcast). All three are mocked so tests never make real API calls,
// connect to ChromaDB, or require a running WebSocket server.

vi.mock('../../src/api-client/claude.js', () => ({
  callApi: vi.fn(),
}));

vi.mock('../../src/memory/queries.js', () => ({
  queryMemories: vi.fn(),
}));

vi.mock('../../src/websocket/server.js', () => ({
  broadcast: vi.fn(),
}));

// ── Import modules under test AFTER mocking ────────────────────────────────

import { callApi } from '../../src/api-client/claude.js';
import { queryMemories, type MemoryResult } from '../../src/memory/queries.js';
import { broadcast } from '../../src/websocket/server.js';
import { createDatabase, closeDatabase, type AppDatabase } from '../../src/database/db.js';
import { createSession } from '../../src/database/queries/sessions.js';
import { getPlansBySession } from '../../src/database/queries/plans.js';
import { getPhasesByPlan } from '../../src/database/queries/phases.js';
import { getHintsByPhase } from '../../src/database/queries/hints.js';
import { setActiveSessionId, clearActiveSessionId } from '../../src/mcp/session.js';
import { runCoachingPipeline } from '../../src/coaching/pipeline.js';

// ── Type aliases for mock functions ────────────────────────────────────────

const mockCallApi = callApi as ReturnType<typeof vi.fn>;
const mockQueryMemories = queryMemories as ReturnType<typeof vi.fn>;
const mockBroadcast = broadcast as ReturnType<typeof vi.fn>;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Builds a mock Coach Agent response matching the expected Zod schema. */
function buildCoachAgentResponse() {
  return {
    phases: [
      {
        number: 1,
        title: 'Phase 1: Setup',
        description: 'Create the basic project structure',
        expected_files: ['src/index.ts'],
        hint_level: 'medium',
        hints: {
          file_hints: [{ path: 'src/index.ts', style: 'suggested' }],
          line_hints: [
            {
              path: 'src/index.ts',
              start: 1,
              end: 10,
              style: 'suggested',
              hover_text: 'Start here',
            },
          ],
        },
        knowledge_gap_opportunities: ['project-structure'],
      },
    ],
    memory_connection: 'Similar to React setup from last session',
    estimated_difficulty: 'beginner',
  };
}

/** Builds sample memory results for testing. */
function buildMemoryResults(): MemoryResult[] {
  return [
    {
      id: 'mem1',
      content: 'Previously worked on React',
      metadata: {
        session_id: '1',
        project: '/test',
        created_at: '2024-01-01',
        importance: 'medium',
        tags: 'react',
      },
      distance: 0.5,
    },
  ];
}

/** Default pipeline input for all tests. */
function defaultPipelineInput() {
  return {
    planText: 'Build a React app',
    issueSummary: 'Create todo app',
    issueNumber: 42,
  };
}

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('runCoachingPipeline (integration)', () => {
  let tmpDir: string;
  let dbPath: string;
  let db: AppDatabase;
  let sessionId: number;

  beforeEach(async () => {
    // Create real SQLite database with all migrations
    tmpDir = mkdtempSync(join(tmpdir(), 'paige-coaching-pipeline-'));
    dbPath = join(tmpDir, 'test.db');
    process.env['PROJECT_DIR'] = tmpDir;

    db = await createDatabase(dbPath);

    // Create a session to satisfy foreign key constraints
    const session = await createSession(db, {
      project_dir: tmpDir,
      status: 'active',
      started_at: new Date().toISOString(),
      issue_number: 42,
      issue_title: 'Create todo app',
    });
    sessionId = session.id;

    // Set the active session so the pipeline can find it
    setActiveSessionId(sessionId);

    // Set up mock return values for happy path
    mockCallApi.mockResolvedValue(buildCoachAgentResponse());
    mockQueryMemories.mockResolvedValue(buildMemoryResults());
    mockBroadcast.mockReturnValue(undefined);
  });

  afterEach(async () => {
    clearActiveSessionId();
    mockCallApi.mockReset();
    mockQueryMemories.mockReset();
    mockBroadcast.mockReset();
    await closeDatabase();
    rmSync(tmpDir, { recursive: true, force: true });
    delete process.env['PROJECT_DIR'];
  });

  // ── Happy Path: Plan Creation ──────────────────────────────────────────────

  it('creates plan with phases and hints from coach agent response', async () => {
    const result = await runCoachingPipeline(defaultPipelineInput());

    // Pipeline should succeed
    expect(result).toBeDefined();

    // Verify plan was created in SQLite
    const plans = await getPlansBySession(db, sessionId);
    expect(plans).toHaveLength(1);

    const plan = plans[0]!;
    expect(plan.session_id).toBe(sessionId);
    expect(plan.total_phases).toBe(1);
    expect(plan.is_active).toBe(1);

    // Verify phase was created
    const phases = await getPhasesByPlan(db, plan.id);
    expect(phases).toHaveLength(1);

    const phase = phases[0]!;
    expect(phase.number).toBe(1);
    expect(phase.title).toBe('Phase 1: Setup');
    expect(phase.description).toBe('Create the basic project structure');
    expect(phase.plan_id).toBe(plan.id);

    // Verify hints were created for the phase
    const hints = await getHintsByPhase(db, phase.id);
    expect(hints.length).toBeGreaterThanOrEqual(1);

    // Verify file hint exists
    const fileHints = hints.filter((h) => h.type === 'file');
    expect(fileHints.length).toBeGreaterThanOrEqual(1);
    expect(fileHints[0]!.path).toBe('src/index.ts');

    // Verify line hint exists
    const lineHints = hints.filter((h) => h.type === 'line');
    expect(lineHints.length).toBeGreaterThanOrEqual(1);
    expect(lineHints[0]!.path).toBe('src/index.ts');
    expect(lineHints[0]!.hover_text).toBe('Start here');
  });

  // ── Happy Path: Broadcast ──────────────────────────────────────────────────

  it('broadcasts coaching:plan_ready after successful pipeline', async () => {
    await runCoachingPipeline(defaultPipelineInput());

    // Verify broadcast was called with coaching:plan_ready
    expect(mockBroadcast).toHaveBeenCalled();

    // Find the coaching:plan_ready broadcast call
    const broadcastCalls = mockBroadcast.mock.calls as Array<[{ type: string; data: unknown }]>;
    const planReadyCall = broadcastCalls.find((call) => call[0].type === 'coaching:plan_ready');

    expect(planReadyCall).toBeDefined();

    // Verify the broadcast payload structure
    const payload = planReadyCall![0].data as { plan: { id: number; phases: unknown[] } };
    expect(payload.plan).toBeDefined();
    expect(payload.plan.id).toBeTypeOf('number');
    expect(payload.plan.phases).toBeInstanceOf(Array);
    expect(payload.plan.phases).toHaveLength(1);
  });

  // ── ChromaDB Unavailable ───────────────────────────────────────────────────

  it('works with empty memories when ChromaDB unavailable', async () => {
    // Simulate ChromaDB being unavailable (returns empty array)
    mockQueryMemories.mockResolvedValue([]);

    const result = await runCoachingPipeline(defaultPipelineInput());

    // Pipeline should still succeed
    expect(result).toBeDefined();

    // Verify plan was still created
    const plans = await getPlansBySession(db, sessionId);
    expect(plans).toHaveLength(1);

    // Coach Agent was still called despite empty memories
    expect(mockCallApi).toHaveBeenCalled();
  });

  // ── Coach Agent Failure ────────────────────────────────────────────────────

  it('returns error when coach agent fails', async () => {
    // Simulate Coach Agent API failure
    mockCallApi.mockRejectedValue(new Error('API call failed'));

    const result = await runCoachingPipeline(defaultPipelineInput());

    // Pipeline should return an error result (not throw)
    expect(result).toBeDefined();
    expect(result.error).toBeTruthy();

    // Verify NO plan was stored — no partial data in SQLite
    const plans = await getPlansBySession(db, sessionId);
    expect(plans).toHaveLength(0);
  });

  // ── No Active Session ──────────────────────────────────────────────────────

  it('returns error when no active session', async () => {
    // Clear the active session before calling
    clearActiveSessionId();

    const result = await runCoachingPipeline(defaultPipelineInput());

    // Pipeline should return an error result
    expect(result).toBeDefined();
    expect(result.error).toBeTruthy();

    // Coach Agent should NOT have been called
    expect(mockCallApi).not.toHaveBeenCalled();
  });

  // ── Previous Plan Deactivation ─────────────────────────────────────────────

  it('marks previous plan as inactive when new plan created', async () => {
    // Run pipeline once to create the first plan
    await runCoachingPipeline(defaultPipelineInput());

    const plansAfterFirst = await getPlansBySession(db, sessionId);
    expect(plansAfterFirst).toHaveLength(1);
    expect(plansAfterFirst[0]!.is_active).toBe(1);

    const firstPlanId = plansAfterFirst[0]!.id;

    // Run pipeline a second time
    await runCoachingPipeline(defaultPipelineInput());

    const plansAfterSecond = await getPlansBySession(db, sessionId);
    expect(plansAfterSecond).toHaveLength(2);

    // First plan should now be inactive
    const firstPlan = plansAfterSecond.find((p) => p.id === firstPlanId);
    expect(firstPlan).toBeDefined();
    expect(firstPlan!.is_active).toBe(0);

    // Second plan should be active
    const secondPlan = plansAfterSecond.find((p) => p.id !== firstPlanId);
    expect(secondPlan).toBeDefined();
    expect(secondPlan!.is_active).toBe(1);
  });

  // ── Memory Filtering Failure ───────────────────────────────────────────────

  it('continues with empty memories when memory query fails', async () => {
    // Simulate memory query throwing an error
    mockQueryMemories.mockRejectedValue(new Error('ChromaDB connection refused'));

    const result = await runCoachingPipeline(defaultPipelineInput());

    // Pipeline should still succeed (graceful degradation)
    expect(result).toBeDefined();
    expect(result.error).toBeFalsy();

    // Verify plan was still created
    const plans = await getPlansBySession(db, sessionId);
    expect(plans).toHaveLength(1);

    // Coach Agent was still called
    expect(mockCallApi).toHaveBeenCalled();
  });
});
