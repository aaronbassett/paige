import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket as WsWebSocket } from 'ws';
import type { PlanningAgentInput } from '../../../../src/planning/agent.js';
import type { AgentPlanOutput } from '../../../../src/planning/parser.js';

// ── Mock dependencies BEFORE imports ──────────────────────────────────────────

vi.mock('../../../../src/planning/agent.js', () => ({
  runPlanningAgent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../src/websocket/server.js', () => ({
  sendToClient: vi.fn(),
  broadcast: vi.fn(),
}));

vi.mock('../../../../src/database/db.js', () => ({
  getDatabase: vi.fn(() => null),
}));

vi.mock('../../../../src/file-system/tree.js', () => ({
  getProjectTree: vi.fn().mockResolvedValue({
    name: 'root',
    path: '.',
    type: 'directory',
    children: [],
  }),
}));

vi.mock('../../../../src/config/env.js', () => ({
  loadEnv: vi.fn(() => ({
    projectDir: '/tmp/repo',
    dataDir: '/tmp/data',
    host: '127.0.0.1',
    port: 3001,
    anthropicApiKey: undefined,
    githubToken: undefined,
    chromadbUrl: 'http://localhost:8000',
  })),
}));

vi.mock('../../../../src/mcp/session.js', () => ({
  getActiveRepo: vi.fn(() => null),
  setActiveSessionId: vi.fn(),
}));

vi.mock('../../../../src/database/queries/sessions.js', () => ({
  createSession: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock('../../../../src/database/queries/plans.js', () => ({
  createPlan: vi.fn().mockResolvedValue({ id: 10 }),
}));

vi.mock('../../../../src/database/queries/phases.js', () => ({
  createPhase: vi.fn().mockResolvedValue({ id: 100 }),
}));

vi.mock('../../../../src/database/queries/hints.js', () => ({
  createHint: vi.fn().mockResolvedValue({ id: 1000 }),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { handlePlanningStart } from '../../../../src/websocket/handlers/planning.js';
import { sendToClient } from '../../../../src/websocket/server.js';
import { runPlanningAgent } from '../../../../src/planning/agent.js';
import { getDatabase } from '../../../../src/database/db.js';
import { getActiveRepo } from '../../../../src/mcp/session.js';
import { createSession } from '../../../../src/database/queries/sessions.js';
import { createPlan } from '../../../../src/database/queries/plans.js';
import { createPhase } from '../../../../src/database/queries/phases.js';
import { createHint } from '../../../../src/database/queries/hints.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const FAKE_WS = {} as WsWebSocket;
const CONNECTION_ID = 'conn-1';

function makeIssueData() {
  return {
    issueNumber: 42,
    issueTitle: 'Add auth',
    issueBody: 'Need auth',
    issueLabels: ['feat'],
    issueUrl: 'https://github.com/test/repo/issues/42',
  };
}

/** Wait for async microtasks / timers to flush. */
function tick(ms = 20): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const SAMPLE_PLAN_OUTPUT: AgentPlanOutput = {
  title: 'Add Authentication',
  summary: 'Implement JWT-based auth with login/logout endpoints',
  relevant_files: ['src/auth.ts', 'src/middleware.ts'],
  phases: [
    {
      number: 1,
      title: 'Setup auth middleware',
      description: 'Create the authentication middleware',
      hint: 'Start with the middleware pattern',
      tasks: [
        {
          title: 'Create auth middleware',
          description: 'Build JWT verification middleware',
          target_files: ['src/middleware.ts'],
          hints: {
            low: 'Look at existing middleware patterns',
            medium: 'Use jsonwebtoken to verify tokens in the Authorization header',
            high: 'Create a function that extracts the Bearer token, verifies it with jwt.verify, and attaches the decoded user to req.user',
          },
        },
      ],
    },
  ],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('handlePlanningStart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends planning:started message immediately', async () => {
    vi.mocked(runPlanningAgent).mockResolvedValue(undefined);

    handlePlanningStart(FAKE_WS, makeIssueData(), CONNECTION_ID);

    await tick();

    expect(sendToClient).toHaveBeenCalledWith(
      CONNECTION_ID,
      expect.objectContaining({
        type: 'planning:started',
        data: expect.objectContaining({
          issueTitle: 'Add auth',
        }),
      }),
    );
  });

  it('calls runPlanningAgent with correct issue input', async () => {
    vi.mocked(runPlanningAgent).mockResolvedValue(undefined);

    handlePlanningStart(FAKE_WS, makeIssueData(), CONNECTION_ID);

    await tick();

    expect(runPlanningAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        issue: expect.objectContaining({
          title: 'Add auth',
          number: 42,
          body: 'Need auth',
          labels: ['feat'],
          url: 'https://github.com/test/repo/issues/42',
        }),
        repoPath: expect.any(String),
        callbacks: expect.objectContaining({
          onProgress: expect.any(Function),
          onPhaseUpdate: expect.any(Function),
          onComplete: expect.any(Function),
          onError: expect.any(Function),
        }),
      }),
    );
  });

  it('uses active repo path when available', async () => {
    vi.mocked(getActiveRepo).mockReturnValue({ owner: 'acme', repo: 'widgets' });
    vi.mocked(runPlanningAgent).mockResolvedValue(undefined);

    handlePlanningStart(FAKE_WS, makeIssueData(), CONNECTION_ID);

    await tick();

    expect(runPlanningAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        repoPath: '/tmp/data/repos/acme/widgets',
      }),
    );
  });

  it('falls back to env.projectDir when no active repo', async () => {
    vi.mocked(getActiveRepo).mockReturnValue(null);
    vi.mocked(runPlanningAgent).mockResolvedValue(undefined);

    handlePlanningStart(FAKE_WS, makeIssueData(), CONNECTION_ID);

    await tick();

    expect(runPlanningAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        repoPath: '/tmp/repo',
      }),
    );
  });

  it('sends planning:error when agent calls onError', async () => {
    vi.mocked(runPlanningAgent).mockImplementation(async ({ callbacks }: PlanningAgentInput) => {
      callbacks.onError('Agent failed');
    });

    handlePlanningStart(FAKE_WS, makeIssueData(), CONNECTION_ID);

    await tick(50);

    expect(sendToClient).toHaveBeenCalledWith(
      CONNECTION_ID,
      expect.objectContaining({
        type: 'planning:error',
        data: expect.objectContaining({
          error: 'Agent failed',
        }),
      }),
    );
  });

  it('sends planning:progress when agent calls onProgress', async () => {
    vi.mocked(runPlanningAgent).mockImplementation(async ({ callbacks }: PlanningAgentInput) => {
      callbacks.onProgress({ message: 'Reading package.json...', toolName: 'Read', filePath: 'package.json' });
    });

    handlePlanningStart(FAKE_WS, makeIssueData(), CONNECTION_ID);

    await tick(50);

    expect(sendToClient).toHaveBeenCalledWith(
      CONNECTION_ID,
      expect.objectContaining({
        type: 'planning:progress',
        data: expect.objectContaining({
          message: 'Reading package.json...',
          toolName: 'Read',
          filePath: 'package.json',
        }),
      }),
    );
  });

  it('sends planning:phase_update when agent calls onPhaseUpdate', async () => {
    vi.mocked(runPlanningAgent).mockImplementation(async ({ callbacks }: PlanningAgentInput) => {
      callbacks.onPhaseUpdate('exploring', 50);
    });

    handlePlanningStart(FAKE_WS, makeIssueData(), CONNECTION_ID);

    await tick(50);

    expect(sendToClient).toHaveBeenCalledWith(
      CONNECTION_ID,
      expect.objectContaining({
        type: 'planning:phase_update',
        data: expect.objectContaining({
          phase: 'exploring',
          progress: 50,
        }),
      }),
    );
  });

  it('sends planning:complete when agent calls onComplete (no DB)', async () => {
    vi.mocked(getDatabase).mockReturnValue(null);
    vi.mocked(runPlanningAgent).mockImplementation(async ({ callbacks }: PlanningAgentInput) => {
      callbacks.onComplete(SAMPLE_PLAN_OUTPUT);
    });

    handlePlanningStart(FAKE_WS, makeIssueData(), CONNECTION_ID);

    await tick(100);

    expect(sendToClient).toHaveBeenCalledWith(
      CONNECTION_ID,
      expect.objectContaining({
        type: 'planning:complete',
        data: expect.objectContaining({
          plan: expect.objectContaining({
            title: 'Add Authentication',
            summary: 'Implement JWT-based auth with login/logout endpoints',
          }),
        }),
      }),
    );
  });

  it('persists plan, phases, and hints to DB when database is available', async () => {
    const fakeDb = {} as any;
    vi.mocked(getDatabase).mockReturnValue(fakeDb);
    vi.mocked(createSession).mockResolvedValue({ id: 5 } as any);
    vi.mocked(createPlan).mockResolvedValue({ id: 20 } as any);
    vi.mocked(createPhase).mockResolvedValue({ id: 200 } as any);
    vi.mocked(createHint).mockResolvedValue({ id: 2000 } as any);

    vi.mocked(runPlanningAgent).mockImplementation(async ({ callbacks }: PlanningAgentInput) => {
      callbacks.onComplete(SAMPLE_PLAN_OUTPUT);
    });

    handlePlanningStart(FAKE_WS, makeIssueData(), CONNECTION_ID);

    await tick(100);

    // Should have created a session
    expect(createSession).toHaveBeenCalledWith(
      fakeDb,
      expect.objectContaining({
        project_dir: expect.any(String),
        status: 'active',
        issue_number: 42,
        issue_title: 'Add auth',
      }),
    );

    // Should have created a plan
    expect(createPlan).toHaveBeenCalledWith(
      fakeDb,
      expect.objectContaining({
        session_id: 5,
        title: 'Add Authentication',
        total_phases: 1,
      }),
    );

    // Should have created one phase (the sample plan has 1 phase)
    expect(createPhase).toHaveBeenCalledWith(
      fakeDb,
      expect.objectContaining({
        plan_id: 20,
        number: 1,
        title: 'Setup auth middleware',
      }),
    );

    // Should have created hints for the task's target files
    expect(createHint).toHaveBeenCalled();
  });

  it('still sends planning:complete even if DB operations fail', async () => {
    const fakeDb = {} as any;
    vi.mocked(getDatabase).mockReturnValue(fakeDb);
    vi.mocked(createSession).mockRejectedValue(new Error('DB write failed'));

    vi.mocked(runPlanningAgent).mockImplementation(async ({ callbacks }: PlanningAgentInput) => {
      callbacks.onComplete(SAMPLE_PLAN_OUTPUT);
    });

    handlePlanningStart(FAKE_WS, makeIssueData(), CONNECTION_ID);

    await tick(100);

    // Should still send planning:complete even though DB failed
    expect(sendToClient).toHaveBeenCalledWith(
      CONNECTION_ID,
      expect.objectContaining({
        type: 'planning:complete',
      }),
    );
  });
});
