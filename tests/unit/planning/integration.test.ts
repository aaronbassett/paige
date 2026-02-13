/**
 * End-to-end smoke test for the planning WebSocket handler flow.
 *
 * Verifies that when `handlePlanningStart` is called with issue data:
 *   1. It immediately sends a `planning:started` message
 *   2. Runs the planning agent (mocked) in the background
 *   3. Streams `planning:progress` and `planning:phase_update` messages
 *   4. On completion, sends `planning:complete` with the full plan payload
 *   5. On error, sends `planning:error`
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies BEFORE importing the handler.
// The handler's import graph touches the WebSocket server, database, file
// system, config, MCP session, and the planning agent — all must be mocked
// to isolate the handler logic.
vi.mock('../../../src/planning/agent.js');
vi.mock('../../../src/websocket/server.js');
vi.mock('../../../src/database/db.js');
vi.mock('../../../src/file-system/tree.js');
vi.mock('../../../src/config/env.js');
vi.mock('../../../src/mcp/session.js');
vi.mock('../../../src/database/queries/sessions.js');
vi.mock('../../../src/database/queries/plans.js');
vi.mock('../../../src/database/queries/phases.js');
vi.mock('../../../src/database/queries/hints.js');

import { handlePlanningStart } from '../../../src/websocket/handlers/planning.js';
import { runPlanningAgent } from '../../../src/planning/agent.js';
import { sendToClient } from '../../../src/websocket/server.js';
import { getDatabase } from '../../../src/database/db.js';
import { getProjectTree } from '../../../src/file-system/tree.js';
import { loadEnv } from '../../../src/config/env.js';
import { getActiveRepo, setActiveSessionId } from '../../../src/mcp/session.js';
import type { WebSocket as WsWebSocket } from 'ws';

describe('Planning flow integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // loadEnv returns a minimal config with projectDir used as the repo path
    vi.mocked(loadEnv).mockReturnValue({
      projectDir: '/tmp/repo',
      dataDir: '/tmp/data',
    } as ReturnType<typeof loadEnv>);

    // getProjectTree resolves with a minimal tree structure
    vi.mocked(getProjectTree).mockResolvedValue({
      name: 'root',
      path: '.',
      type: 'directory',
      children: [],
    });

    // No database available — skip DB persistence path entirely
    vi.mocked(getDatabase).mockReturnValue(null);

    // No active repo — handler falls back to projectDir
    vi.mocked(getActiveRepo).mockReturnValue(null);

    // setActiveSessionId is a no-op in this test
    vi.mocked(setActiveSessionId).mockReturnValue(undefined);
  });

  it('sends planning:started then planning:complete on success', async () => {
    // Mock runPlanningAgent to invoke callbacks synchronously within the
    // async function, simulating a successful planning run.
    vi.mocked(runPlanningAgent).mockImplementation(async ({ callbacks }) => {
      callbacks.onProgress({ message: 'Reading...' });
      callbacks.onPhaseUpdate('exploring', 50);
      callbacks.onComplete({
        title: 'Test Plan',
        summary: 'A test',
        relevant_files: ['src/index.ts'],
        phases: [
          {
            number: 1,
            title: 'Phase 1',
            description: 'Do it',
            hint: 'Start here',
            tasks: [
              {
                title: 'Task 1',
                description: 'First task',
                target_files: ['src/index.ts'],
                hints: { low: 'L', medium: 'M', high: 'H' },
              },
            ],
          },
        ],
      });
    });

    // handlePlanningStart is fire-and-forget (returns void, not a Promise)
    handlePlanningStart({} as WsWebSocket, {
      issueNumber: 1,
      issueTitle: 'Test Issue',
      issueBody: 'Test body',
      issueLabels: [],
      issueUrl: 'https://github.com/test/repo/issues/1',
    }, 'conn-1');

    // Wait for the async pipeline to settle
    await new Promise((r) => setTimeout(r, 100));

    const calls = vi.mocked(sendToClient).mock.calls;
    const types = calls.map(([, msg]) => msg.type);

    // Verify the expected message sequence
    expect(types).toContain('planning:started');
    expect(types).toContain('planning:progress');
    expect(types).toContain('planning:phase_update');
    expect(types).toContain('planning:complete');

    // Verify planning:started is the first message sent
    expect(types[0]).toBe('planning:started');

    // Verify the complete payload has the plan data
    const completeCall = calls.find(([, msg]) => msg.type === 'planning:complete');
    expect(completeCall).toBeDefined();

    const completeMessage = completeCall![1];
    expect(completeMessage.type).toBe('planning:complete');

    // Access data from the discriminated union
    if (completeMessage.type === 'planning:complete') {
      const payload = completeMessage.data;
      expect(payload.plan.title).toBe('Test Plan');
      expect(payload.plan.summary).toBe('A test');
      expect(payload.plan.phases).toHaveLength(1);
      expect(payload.plan.phases[0]!.title).toBe('Phase 1');
      expect(payload.plan.phases[0]!.tasks[0]!.title).toBe('Task 1');
      expect(payload.fileTree).toBeDefined();
      expect(payload.issueContext.number).toBe(1);
      expect(payload.issueContext.title).toBe('Test Issue');
      expect(payload.fileHints).toHaveLength(1);
      expect(payload.fileHints[0]!.path).toBe('src/index.ts');
    }
  });

  it('sends planning:error when agent calls onError', async () => {
    vi.mocked(runPlanningAgent).mockImplementation(async ({ callbacks }) => {
      callbacks.onError('Agent crashed');
    });

    handlePlanningStart({} as WsWebSocket, {
      issueNumber: 2,
      issueTitle: 'Failing',
      issueBody: 'Body',
      issueLabels: [],
      issueUrl: 'https://github.com/test/repo/issues/2',
    }, 'conn-2');

    // Wait for the async pipeline to settle
    await new Promise((r) => setTimeout(r, 100));

    const calls = vi.mocked(sendToClient).mock.calls;
    const types = calls.map(([, msg]) => msg.type);

    // The handler always sends planning:started first, then errors propagate
    expect(types).toContain('planning:started');
    expect(types).toContain('planning:error');

    // Verify the error payload
    const errorCall = calls.find(([, msg]) => msg.type === 'planning:error');
    expect(errorCall).toBeDefined();

    if (errorCall![1].type === 'planning:error') {
      expect(errorCall![1].data.error).toBe('Agent crashed');
      expect(errorCall![1].data.sessionId).toBe('conn-2');
    }
  });

  it('sends planning:error when runPlanningAgent rejects', async () => {
    vi.mocked(runPlanningAgent).mockRejectedValue(new Error('SDK unavailable'));

    handlePlanningStart({} as WsWebSocket, {
      issueNumber: 3,
      issueTitle: 'SDK Failure',
      issueBody: 'Body',
      issueLabels: [],
      issueUrl: 'https://github.com/test/repo/issues/3',
    }, 'conn-3');

    // Wait for the async pipeline to settle
    await new Promise((r) => setTimeout(r, 100));

    const calls = vi.mocked(sendToClient).mock.calls;
    const types = calls.map(([, msg]) => msg.type);

    expect(types).toContain('planning:started');
    expect(types).toContain('planning:error');

    const errorCall = calls.find(([, msg]) => msg.type === 'planning:error');
    expect(errorCall).toBeDefined();

    if (errorCall![1].type === 'planning:error') {
      expect(errorCall![1].data.error).toBe('SDK unavailable');
    }
  });

  it('uses projectDir as repoPath when getActiveRepo returns null', async () => {
    vi.mocked(runPlanningAgent).mockImplementation(async ({ repoPath, callbacks }) => {
      // Verify the repoPath was derived from projectDir (not from activeRepo)
      expect(repoPath).toBe('/tmp/repo');
      callbacks.onComplete({
        title: 'Plan',
        summary: 'Summary',
        relevant_files: [],
        phases: [],
      });
    });

    handlePlanningStart({} as WsWebSocket, {
      issueNumber: 4,
      issueTitle: 'Path Test',
      issueBody: 'Body',
      issueLabels: [],
      issueUrl: 'https://github.com/test/repo/issues/4',
    }, 'conn-4');

    await new Promise((r) => setTimeout(r, 100));

    expect(runPlanningAgent).toHaveBeenCalledTimes(1);
  });

  it('gracefully handles getProjectTree failure', async () => {
    // Make getProjectTree reject — the handler should still send planning:complete
    // with an empty file tree
    vi.mocked(getProjectTree).mockRejectedValue(new Error('tree scan failed'));

    vi.mocked(runPlanningAgent).mockImplementation(async ({ callbacks }) => {
      callbacks.onComplete({
        title: 'Plan Despite Tree Failure',
        summary: 'Works anyway',
        relevant_files: [],
        phases: [],
      });
    });

    handlePlanningStart({} as WsWebSocket, {
      issueNumber: 5,
      issueTitle: 'Tree Failure',
      issueBody: 'Body',
      issueLabels: [],
      issueUrl: 'https://github.com/test/repo/issues/5',
    }, 'conn-5');

    await new Promise((r) => setTimeout(r, 100));

    const calls = vi.mocked(sendToClient).mock.calls;
    const types = calls.map(([, msg]) => msg.type);

    expect(types).toContain('planning:complete');

    const completeCall = calls.find(([, msg]) => msg.type === 'planning:complete');
    if (completeCall![1].type === 'planning:complete') {
      // fileTree should be empty array when tree scan fails
      expect(completeCall![1].data.fileTree).toEqual([]);
    }
  });
});
