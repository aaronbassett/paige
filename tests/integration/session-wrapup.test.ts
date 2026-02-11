import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase, closeDatabase, type AppDatabase } from '../../src/database/db.js';
import { createSession, getSession } from '../../src/database/queries/sessions.js';
import { getGapsBySession } from '../../src/database/queries/gaps.js';
import { getKatasByGap } from '../../src/database/queries/katas.js';
import { getDreyfusBySkill } from '../../src/database/queries/dreyfus.js';
import { setActiveSessionId, clearActiveSessionId } from '../../src/mcp/session.js';

// ── Mock external dependencies ──────────────────────────────────────────────
//
// Mock callApi so tests never make real Claude API calls.
// Mock addMemories so tests don't need a running ChromaDB instance.
// Mock broadcast so tests don't need a running WebSocket server.

vi.mock('../../src/api-client/claude.js', () => ({
  callApi: vi.fn(),
}));

vi.mock('../../src/memory/queries.js', () => ({
  addMemories: vi.fn(),
}));

vi.mock('../../src/websocket/server.js', () => ({
  broadcast: vi.fn(),
}));

// ── Import mocked modules AFTER vi.mock declarations ────────────────────────

import { callApi, type CallApiOptions } from '../../src/api-client/claude.js';
import { addMemories } from '../../src/memory/queries.js';
import { broadcast } from '../../src/websocket/server.js';
import { runSessionWrapUp } from '../../src/coaching/wrap-up.js';

import type {
  KnowledgeGapResponse,
  DreyfusAssessmentResponse,
  MemorySummarisationResponse,
} from '../../src/api-client/schemas.js';
import type { SessionCompletedData } from '../../src/types/websocket.js';

// ── Type-safe access to mocked functions ────────────────────────────────────

const mockCallApi = vi.mocked(callApi);
const mockAddMemories = vi.mocked(addMemories);
const mockBroadcast = vi.mocked(broadcast);

// ── Mock response fixtures ──────────────────────────────────────────────────

const knowledgeGapResponse: KnowledgeGapResponse = {
  knowledge_gaps: [
    {
      topic: 'React hooks',
      evidence: 'Used useState incorrectly 3 times',
      severity: 'medium',
      related_concepts: ['closures', 'state management'],
    },
  ],
  kata_specs: [
    {
      title: 'Hook Lifecycle',
      description: 'Practice useState and useEffect',
      scaffolding_code: 'function App() {}',
      instructor_notes: 'Focus on dependency arrays',
      constraints: ['No class components'],
    },
  ],
};

const dreyfusResponse: DreyfusAssessmentResponse = {
  assessments: [
    {
      skill_area: 'React hooks',
      stage: 'Advanced Beginner',
      confidence: 0.7,
      evidence: 'Can use hooks but struggles with dependencies',
    },
  ],
};

const memorySummarisationResponse: MemorySummarisationResponse = {
  memories: [
    {
      content: 'User learned about React useState hook dependency arrays',
      tags: ['react', 'hooks'],
      importance: 'medium',
    },
  ],
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Sets up mockCallApi to return different responses based on the callType.
 * The wrap-up function calls callApi 3 times: knowledge_gap_agent, dreyfus_agent, reflection_agent.
 */
function setupHappyPathMocks(): void {
  mockCallApi.mockImplementation((options: CallApiOptions<unknown>): Promise<unknown> => {
    switch (options.callType) {
      case 'knowledge_gap_agent':
        return Promise.resolve(knowledgeGapResponse);
      case 'dreyfus_agent':
        return Promise.resolve(dreyfusResponse);
      case 'reflection_agent':
        return Promise.resolve(memorySummarisationResponse);
      default:
        return Promise.reject(new Error(`Unexpected callType: ${options.callType}`));
    }
  });
}

/**
 * Sets up mockCallApi where a specific agent fails with an error.
 */
function setupAgentFailureMock(failingAgent: string): void {
  mockCallApi.mockImplementation((options: CallApiOptions<unknown>): Promise<unknown> => {
    if (options.callType === failingAgent) {
      return Promise.reject(new Error(`${failingAgent} failed`));
    }
    switch (options.callType) {
      case 'knowledge_gap_agent':
        return Promise.resolve(knowledgeGapResponse);
      case 'dreyfus_agent':
        return Promise.resolve(dreyfusResponse);
      case 'reflection_agent':
        return Promise.resolve(memorySummarisationResponse);
      default:
        return Promise.reject(new Error(`Unexpected callType: ${options.callType}`));
    }
  });
}

/**
 * Sets up mockCallApi where ALL agents fail.
 */
function setupAllAgentsFailMock(): void {
  mockCallApi.mockImplementation((options: CallApiOptions<unknown>): Promise<unknown> => {
    return Promise.reject(new Error(`${options.callType} failed`));
  });
}

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('runSessionWrapUp', () => {
  let tmpDir: string;
  let dbPath: string;
  let db: AppDatabase;
  let sessionId: number;

  beforeEach(async () => {
    // Create temp directory and real SQLite database
    tmpDir = mkdtempSync(join(tmpdir(), 'paige-wrapup-'));
    dbPath = join(tmpDir, 'wrapup-test.db');
    process.env['PROJECT_DIR'] = tmpDir;
    process.env['ANTHROPIC_API_KEY'] = 'test-key';

    db = await createDatabase(dbPath);

    // Create a session with issue_title (used by memory summarisation agent)
    const session = await createSession(db, {
      project_dir: tmpDir,
      status: 'active',
      started_at: new Date().toISOString(),
      issue_title: 'Fix React hooks in dashboard component',
    });
    sessionId = session.id;

    // Set the active session ID so wrap-up can find it
    setActiveSessionId(sessionId);

    // Default mock setup: addMemories returns { added: 1 }
    mockAddMemories.mockResolvedValue({ added: 1 });

    // Reset all mocks
    mockCallApi.mockReset();
    mockBroadcast.mockReset();
    mockAddMemories.mockReset();
    mockAddMemories.mockResolvedValue({ added: 1 });
  });

  afterEach(async () => {
    clearActiveSessionId();
    await closeDatabase();
    rmSync(tmpDir, { recursive: true, force: true });
    delete process.env['PROJECT_DIR'];
    delete process.env['ANTHROPIC_API_KEY'];
  });

  // ── Happy Path: Knowledge gaps and katas stored ──────────────────────────

  it('stores knowledge gaps and katas from gap agent response', async () => {
    setupHappyPathMocks();

    await runSessionWrapUp(sessionId);

    // Verify knowledge gaps were inserted into SQLite
    const gaps = await getGapsBySession(db, sessionId);
    expect(gaps).toHaveLength(1);

    const gap = gaps[0]!;
    expect(gap.topic).toBe('React hooks');
    expect(gap.evidence).toBe('Used useState incorrectly 3 times');
    expect(gap.severity).toBe('medium');
    expect(gap.session_id).toBe(sessionId);

    // related_concepts should be stored as a JSON string
    const relatedConcepts = JSON.parse(gap.related_concepts) as string[];
    expect(relatedConcepts).toEqual(['closures', 'state management']);

    // Verify katas were inserted, linked to the gap
    const katas = await getKatasByGap(db, gap.id);
    expect(katas).toHaveLength(1);

    const kata = katas[0]!;
    expect(kata.title).toBe('Hook Lifecycle');
    expect(kata.description).toBe('Practice useState and useEffect');
    expect(kata.scaffolding_code).toBe('function App() {}');
    expect(kata.instructor_notes).toBe('Focus on dependency arrays');

    // constraints should be stored as a JSON string
    const constraints = JSON.parse(kata.constraints) as string[];
    expect(constraints).toEqual(['No class components']);
  });

  // ── Happy Path: Dreyfus assessments upserted ────────────────────────────

  it('upserts dreyfus assessments', async () => {
    setupHappyPathMocks();

    await runSessionWrapUp(sessionId);

    // Verify dreyfus assessment was upserted
    const assessment = await getDreyfusBySkill(db, 'React hooks');
    expect(assessment).toBeDefined();
    expect(assessment!.skill_area).toBe('React hooks');
    expect(assessment!.stage).toBe('Advanced Beginner');
    expect(assessment!.confidence).toBe(0.7);
    expect(assessment!.evidence).toBe('Can use hooks but struggles with dependencies');
  });

  // ── Happy Path: Memories stored via addMemories ─────────────────────────

  it('stores memories via addMemories', async () => {
    setupHappyPathMocks();

    await runSessionWrapUp(sessionId);

    // Verify addMemories was called with the reflection agent output
    expect(mockAddMemories).toHaveBeenCalledTimes(1);

    const callArgs = mockAddMemories.mock.calls[0]!;
    const memories = callArgs[0] as Array<{ content: string; tags: string[]; importance: string }>;

    expect(memories).toHaveLength(1);
    expect(memories[0]!.content).toBe('User learned about React useState hook dependency arrays');
    expect(memories[0]!.tags).toEqual(['react', 'hooks']);
    expect(memories[0]!.importance).toBe('medium');

    // sessionId should be passed as a string
    const passedSessionId = callArgs[1];
    expect(passedSessionId).toBe(String(sessionId));
  });

  // ── Happy Path: Session marked as completed ─────────────────────────────

  it('marks session as completed', async () => {
    setupHappyPathMocks();

    await runSessionWrapUp(sessionId);

    // Verify session status was updated to completed
    const session = await getSession(db, sessionId);
    expect(session).toBeDefined();
    expect(session!.status).toBe('completed');
    expect(session!.ended_at).not.toBeNull();
  });

  // ── Happy Path: Broadcasts session:completed with correct counts ────────

  it('broadcasts session:completed with correct counts', async () => {
    setupHappyPathMocks();

    const result = await runSessionWrapUp(sessionId);

    // Verify the return value has the correct counts
    expect(result.gapsIdentified).toBe(1);
    expect(result.katasGenerated).toBe(1);
    expect(result.assessmentsUpdated).toBe(1);
    expect(result.memoriesAdded).toBe(1);

    // Verify broadcast was called with the session:completed message
    expect(mockBroadcast).toHaveBeenCalledTimes(1);

    const broadcastCall = mockBroadcast.mock.calls[0]![0] as {
      type: string;
      data: SessionCompletedData;
    };
    expect(broadcastCall.type).toBe('session:completed');
    expect(broadcastCall.data.gaps_identified).toBe(1);
    expect(broadcastCall.data.katas_generated).toBe(1);
    expect(broadcastCall.data.assessments_updated).toBe(1);
    expect(broadcastCall.data.memories_added).toBe(1);
  });

  // ── Partial Failure: Knowledge gap agent fails, others succeed ──────────

  it('continues when knowledge gap agent fails', async () => {
    setupAgentFailureMock('knowledge_gap_agent');

    const result = await runSessionWrapUp(sessionId);

    // Knowledge gap agent failed: no gaps or katas
    expect(result.gapsIdentified).toBe(0);
    expect(result.katasGenerated).toBe(0);

    // Other agents should still succeed
    expect(result.assessmentsUpdated).toBe(1);
    expect(result.memoriesAdded).toBe(1);

    // Verify no gaps in SQLite
    const gaps = await getGapsBySession(db, sessionId);
    expect(gaps).toHaveLength(0);

    // Dreyfus assessment should still exist
    const assessment = await getDreyfusBySkill(db, 'React hooks');
    expect(assessment).toBeDefined();

    // addMemories should still have been called
    expect(mockAddMemories).toHaveBeenCalledTimes(1);

    // Session should still be marked as completed
    const session = await getSession(db, sessionId);
    expect(session).toBeDefined();
    expect(session!.status).toBe('completed');
  });

  // ── Total Failure: All agents fail, session still completed ─────────────

  it('continues when all agents fail and still marks completed', async () => {
    setupAllAgentsFailMock();
    mockAddMemories.mockResolvedValue({ added: 0 });

    await runSessionWrapUp(sessionId);

    // Session should still be marked as completed even when all agents fail
    const session = await getSession(db, sessionId);
    expect(session).toBeDefined();
    expect(session!.status).toBe('completed');
    expect(session!.ended_at).not.toBeNull();

    // broadcast should still fire
    expect(mockBroadcast).toHaveBeenCalledTimes(1);
    const broadcastCall = mockBroadcast.mock.calls[0]![0] as {
      type: string;
      data: SessionCompletedData;
    };
    expect(broadcastCall.type).toBe('session:completed');
  });

  // ── Total Failure: Returns zero counts ──────────────────────────────────

  it('returns zero counts when all agents fail', async () => {
    setupAllAgentsFailMock();
    mockAddMemories.mockResolvedValue({ added: 0 });

    const result = await runSessionWrapUp(sessionId);

    expect(result.gapsIdentified).toBe(0);
    expect(result.katasGenerated).toBe(0);
    expect(result.assessmentsUpdated).toBe(0);
    expect(result.memoriesAdded).toBe(0);

    // Verify no gaps stored
    const gaps = await getGapsBySession(db, sessionId);
    expect(gaps).toHaveLength(0);
  });

  // ── Dreyfus Upsert: Existing assessment updated, not duplicated ─────────

  it('upserts dreyfus assessments without duplication', async () => {
    setupHappyPathMocks();

    // Run wrap-up once to create the initial assessment
    await runSessionWrapUp(sessionId);

    // Verify first assessment exists
    const firstAssessment = await getDreyfusBySkill(db, 'React hooks');
    expect(firstAssessment).toBeDefined();
    expect(firstAssessment!.stage).toBe('Advanced Beginner');

    // Reset session for a second wrap-up: create a new active session
    await closeDatabase();
    db = await createDatabase(dbPath);

    const session2 = await createSession(db, {
      project_dir: tmpDir,
      status: 'active',
      started_at: new Date().toISOString(),
      issue_title: 'Refactor hooks',
    });
    setActiveSessionId(session2.id);

    // Mock a different Dreyfus response for the second run
    const updatedDreyfusResponse: DreyfusAssessmentResponse = {
      assessments: [
        {
          skill_area: 'React hooks',
          stage: 'Competent',
          confidence: 0.85,
          evidence: 'Correctly uses hooks with proper dependency arrays',
        },
      ],
    };

    mockCallApi.mockReset();
    mockCallApi.mockImplementation((options: CallApiOptions<unknown>): Promise<unknown> => {
      switch (options.callType) {
        case 'knowledge_gap_agent':
          return Promise.resolve(knowledgeGapResponse);
        case 'dreyfus_agent':
          return Promise.resolve(updatedDreyfusResponse);
        case 'reflection_agent':
          return Promise.resolve(memorySummarisationResponse);
        default:
          return Promise.reject(new Error(`Unexpected callType: ${options.callType}`));
      }
    });
    mockBroadcast.mockReset();
    mockAddMemories.mockReset();
    mockAddMemories.mockResolvedValue({ added: 1 });

    // Run wrap-up a second time
    await runSessionWrapUp(session2.id);

    // Verify the assessment was UPDATED (not duplicated)
    const updatedAssessment = await getDreyfusBySkill(db, 'React hooks');
    expect(updatedAssessment).toBeDefined();
    expect(updatedAssessment!.stage).toBe('Competent');
    expect(updatedAssessment!.confidence).toBe(0.85);
    expect(updatedAssessment!.evidence).toBe('Correctly uses hooks with proper dependency arrays');

    // The ID should be the same (upsert, not insert)
    expect(updatedAssessment!.id).toBe(firstAssessment!.id);
  });
});
