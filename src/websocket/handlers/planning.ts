/**
 * WebSocket handler for the planning flow.
 *
 * Receives `session:select_issue` data enriched with issue details,
 * runs the planning agent in the background, streams progress via
 * WebSocket messages, persists the plan to SQLite, and sends the
 * final `planning:complete` message.
 */

import { join } from 'node:path';
import type { WebSocket as WsWebSocket } from 'ws';
import { getLogger } from '../../logger/logtape.js';
import { sendToClient } from '../server.js';

const logger = getLogger(['paige', 'ws-handler', 'planning']);
import { loadEnv } from '../../config/env.js';
import { getActiveRepo, setActiveSessionId } from '../../mcp/session.js';
import { getDatabase } from '../../database/db.js';
import { createSession } from '../../database/queries/sessions.js';
import { createPlan } from '../../database/queries/plans.js';
import { createPhase } from '../../database/queries/phases.js';
import { createHint } from '../../database/queries/hints.js';
import { getProjectTree } from '../../file-system/tree.js';
import { runPlanningAgent } from '../../planning/agent.js';
import type { AgentPlanOutput } from '../../planning/parser.js';
import type { IssueInput } from '../../planning/prompts.js';
import type {
  PlanningStartedMessage,
  PlanningProgressMessage,
  PlanningPhaseUpdateMessage,
  PlanningCompleteMessage,
  PlanningErrorMessage,
  PlanPhase,
  ServerToClientMessage,
} from '../../types/websocket.js';

// ── Input shape from the client ──────────────────────────────────────────────

/** Data payload sent by the Electron UI when the user picks an issue. */
interface PlanningStartData {
  readonly issueNumber: number;
  readonly issueTitle?: string;
  readonly issueBody?: string;
  readonly issueLabels?: readonly string[];
  readonly issueUrl?: string;
}

// ── Handler ──────────────────────────────────────────────────────────────────

/**
 * Handles planning start requests from the Electron client.
 *
 * This is a fire-and-forget handler: it sends `planning:started` immediately,
 * then kicks off the planning agent in the background. Progress, phase updates,
 * completion, and errors are all streamed back via WebSocket.
 *
 * The function intentionally does NOT await the async work so the WebSocket
 * router can continue processing other messages.
 */
export function handlePlanningStart(_ws: WsWebSocket, data: unknown, connectionId: string): void {
  const input = data as PlanningStartData;

  // Send immediate acknowledgment
  const startedMessage: PlanningStartedMessage = {
    type: 'planning:started',
    data: {
      sessionId: connectionId,
      issueTitle: input.issueTitle ?? '',
    },
  };
  sendToClient(connectionId, startedMessage as ServerToClientMessage);

  // Determine the repo path
  const env = loadEnv();
  const activeRepo = getActiveRepo();
  const repoPath =
    activeRepo !== null
      ? join(env.dataDir, 'repos', activeRepo.owner, activeRepo.repo)
      : env.projectDir;

  // Build the issue input for the planning agent
  const issue: IssueInput = {
    title: input.issueTitle ?? '',
    body: input.issueBody ?? '',
    number: input.issueNumber,
    labels: [...(input.issueLabels ?? [])],
    url: input.issueUrl ?? '',
  };

  // Fire-and-forget: run the planning pipeline in the background
  void runPlanningPipeline(connectionId, issue, repoPath, input).catch((err: unknown) => {
    logger.error`Unhandled error in planning pipeline: ${err instanceof Error ? err.message : err}`;
    const errorMessage: PlanningErrorMessage = {
      type: 'planning:error',
      data: {
        sessionId: connectionId,
        error: err instanceof Error ? err.message : 'Planning pipeline failed unexpectedly',
      },
    };
    sendToClient(connectionId, errorMessage as ServerToClientMessage);
  });
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Runs the full planning pipeline:
 *   1. Executes the planning agent with streaming callbacks
 *   2. On completion, persists plan/phases/hints to SQLite
 *   3. Fetches the project file tree
 *   4. Sends `planning:complete` with the full payload
 */
async function runPlanningPipeline(
  connectionId: string,
  issue: IssueInput,
  repoPath: string,
  input: PlanningStartData,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    runPlanningAgent({
      issue,
      repoPath,
      callbacks: {
        onProgress(event) {
          const progressMessage: PlanningProgressMessage = {
            type: 'planning:progress',
            data: {
              message: event.message,
              toolName: event.toolName,
              filePath: event.filePath,
            },
          };
          sendToClient(connectionId, progressMessage as ServerToClientMessage);
        },

        onPhaseUpdate(phase, progress) {
          const phaseMessage: PlanningPhaseUpdateMessage = {
            type: 'planning:phase_update',
            data: { phase, progress },
          };
          sendToClient(connectionId, phaseMessage as ServerToClientMessage);
        },

        onComplete(plan) {
          void handlePlanComplete(connectionId, plan, issue, repoPath, input)
            .then(resolve)
            .catch(reject);
        },

        onError(error) {
          const errorMessage: PlanningErrorMessage = {
            type: 'planning:error',
            data: {
              sessionId: connectionId,
              error,
            },
          };
          sendToClient(connectionId, errorMessage as ServerToClientMessage);
          resolve();
        },
      },
    }).catch(reject);
  });
}

// ── Completion Handler ───────────────────────────────────────────────────────

/**
 * Handles the completion of the planning agent:
 *   - Persists session, plan, phases, and hints to SQLite (if DB available)
 *   - Fetches the project file tree
 *   - Builds and sends the `planning:complete` message
 */
async function handlePlanComplete(
  connectionId: string,
  plan: AgentPlanOutput,
  issue: IssueInput,
  repoPath: string,
  input: PlanningStartData,
): Promise<void> {
  // Attempt to persist to the database (graceful degradation if unavailable)
  const sessionIdStr = connectionId;
  try {
    await persistPlanToDb(plan, repoPath, input);
  } catch (err) {
    logger.error`Failed to persist plan to DB (continuing): ${err instanceof Error ? err.message : err}`;
  }

  // Fetch the project file tree for the completion payload
  let fileTree: Awaited<ReturnType<typeof getProjectTree>>['children'];
  try {
    const tree = await getProjectTree(repoPath);
    fileTree = tree.children ?? [];
  } catch {
    fileTree = [];
  }

  // Build phase data for the wire format
  const phases: PlanPhase[] = plan.phases.map((phase, index) => ({
    number: phase.number,
    title: phase.title,
    description: phase.description,
    hint: phase.hint,
    status: index === 0 ? ('active' as const) : ('pending' as const),
    tasks: phase.tasks.map((task) => ({
      title: task.title,
      description: task.description,
      targetFiles: task.target_files,
      hints: task.hints,
    })),
  }));

  // Build file hints from each phase's task target files
  const fileHints = plan.phases.flatMap((phase) =>
    phase.tasks.flatMap((task) =>
      task.target_files.map((path) => ({
        path,
        style: phase.number === 1 ? ('obvious' as const) : ('subtle' as const),
        phase: phase.number,
      })),
    ),
  );

  const completeMessage: PlanningCompleteMessage = {
    type: 'planning:complete',
    data: {
      sessionId: sessionIdStr,
      repoPath,
      plan: {
        title: plan.title,
        summary: plan.summary,
        phases,
      },
      fileTree,
      fileHints,
      issueContext: {
        title: issue.title,
        number: issue.number,
        body: issue.body,
        labels: [...issue.labels],
        url: issue.url,
      },
    },
  };

  sendToClient(connectionId, completeMessage as ServerToClientMessage);

  // Send session:start so CoachingSidebar populates with issue context + phases
  const sessionStartMessage = {
    type: 'session:start' as const,
    data: {
      sessionId: sessionIdStr,
      issueContext: {
        number: issue.number,
        title: issue.title,
        url: issue.url,
        labels: issue.labels.map((label) => ({ name: label, color: '#6b6960' })),
      },
      phases: phases.map((phase) => ({
        number: phase.number as 1 | 2 | 3 | 4 | 5,
        title: phase.title,
        status: phase.status === 'active' ? ('active' as const) : ('pending' as const),
        summary: phase.description,
        steps: phase.tasks.map((task) => ({
          title: task.title,
          description: task.description,
        })),
      })),
      initialHintLevel: 0 as const,
    },
  };
  sendToClient(connectionId, sessionStartMessage as unknown as ServerToClientMessage);
}

// ── Database Persistence ─────────────────────────────────────────────────────

/**
 * Persists the plan, its phases, and file hints to SQLite.
 *
 * Creates a session first, then the plan, then phases, then hints for each
 * phase's tasks. Skips entirely if the database is not available.
 */
async function persistPlanToDb(
  plan: AgentPlanOutput,
  repoPath: string,
  input: PlanningStartData,
): Promise<void> {
  const db = getDatabase();
  if (db === null) {
    return;
  }

  // Create a session for this planning run
  const session = await createSession(db, {
    project_dir: repoPath,
    status: 'active',
    started_at: new Date().toISOString(),
    issue_number: input.issueNumber,
    issue_title: input.issueTitle ?? null,
  });

  setActiveSessionId(session.id);

  // Create the plan record
  const dbPlan = await createPlan(db, {
    session_id: session.id,
    title: plan.title,
    description: plan.summary,
    total_phases: plan.phases.length,
    created_at: new Date().toISOString(),
  });

  // Create phases and their hints
  for (const phase of plan.phases) {
    const dbPhase = await createPhase(db, {
      plan_id: dbPlan.id,
      number: phase.number,
      title: phase.title,
      description: phase.description,
      hint_level: 'low',
      status: phase.number === 1 ? 'active' : 'pending',
    });

    // Create file hints for each task's target files
    for (const task of phase.tasks) {
      for (const targetFile of task.target_files) {
        await createHint(db, {
          phase_id: dbPhase.id,
          type: 'file',
          path: targetFile,
          style: 'suggested',
          hover_text: task.hints.low,
          required_level: 'low',
        });
      }
    }
  }
}
