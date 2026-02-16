/**
 * WebSocket handler for dashboard:resume_task.
 *
 * Restores a previously planned session from the database and sends
 * `planning:complete` + `session:start` so the frontend can transition
 * directly to the IDE without re-running the planning agent.
 */

import { join } from 'node:path';
import type { WebSocket as WsWebSocket } from 'ws';
import { getLogger } from '../../logger/logtape.js';
import { sendToClient } from '../server.js';
import { loadEnv } from '../../config/env.js';
import { getActiveRepo, setActiveSessionId } from '../../mcp/session.js';
import { getDatabase } from '../../database/db.js';
import { getSessionByIssueNumber } from '../../database/queries/sessions.js';
import { getPlansBySession } from '../../database/queries/plans.js';
import { getPhasesByPlan } from '../../database/queries/phases.js';
import { getHintsByPhase } from '../../database/queries/hints.js';
import { getProjectTree } from '../../file-system/tree.js';
import type {
  DashboardResumeTaskData,
  PlanningCompleteMessage,
  PlanPhase,
  ServerToClientMessage,
} from '../../types/websocket.js';

const logger = getLogger(['paige', 'ws-handler', 'resume']);

/**
 * Handles `dashboard:resume_task` messages.
 *
 * Looks up the session by issue number, loads the plan and phases from
 * the database, and sends the same `planning:complete` + `session:start`
 * messages that the planning agent would send — without calling the API.
 */
export async function handleResumeTask(
  _ws: WsWebSocket,
  data: unknown,
  connectionId: string,
): Promise<void> {
  const { issueNumber } = data as DashboardResumeTaskData;

  const db = getDatabase();
  if (db === null) {
    logger.error`Database not available for session restore`;
    sendToClient(connectionId, {
      type: 'planning:error',
      data: { sessionId: connectionId, error: 'Database not available' },
    } as ServerToClientMessage);
    return;
  }

  // Find the active session for this issue
  const session = await getSessionByIssueNumber(db, issueNumber);
  if (session === undefined) {
    logger.error`No active session found for issue #${String(issueNumber)}`;
    sendToClient(connectionId, {
      type: 'planning:error',
      data: { sessionId: connectionId, error: `No active session for issue #${issueNumber}` },
    } as ServerToClientMessage);
    return;
  }

  setActiveSessionId(session.id);

  // Load the plan for this session
  const plans = await getPlansBySession(db, session.id);
  if (plans.length === 0) {
    logger.error`No plan found for session ${String(session.id)}`;
    sendToClient(connectionId, {
      type: 'planning:error',
      data: { sessionId: connectionId, error: 'No plan found for this session' },
    } as ServerToClientMessage);
    return;
  }

  const plan = plans[plans.length - 1]!; // Use the most recent plan

  // Load phases and their hints
  const dbPhases = await getPhasesByPlan(db, plan.id);
  const phases: PlanPhase[] = [];
  const fileHints: Array<{
    path: string;
    style: 'subtle' | 'obvious' | 'unmissable';
    phase: number;
  }> = [];

  for (const dbPhase of dbPhases) {
    const hints = await getHintsByPhase(db, dbPhase.id);

    phases.push({
      number: dbPhase.number,
      title: dbPhase.title,
      description: dbPhase.description,
      hint: hints.length > 0 ? (hints[0]!.hover_text ?? '') : '',
      status: dbPhase.status === 'active' ? 'active' : 'pending',
      tasks: hints.map((h) => ({
        title: h.path,
        description: h.hover_text ?? '',
        targetFiles: [h.path],
        hints: { low: h.hover_text ?? '', medium: '', high: '' },
      })),
    });

    for (const h of hints) {
      fileHints.push({
        path: h.path,
        style: dbPhase.number === 1 ? 'obvious' : 'subtle',
        phase: dbPhase.number,
      });
    }
  }

  // Determine repo path
  const env = loadEnv();
  const activeRepo = getActiveRepo();
  const repoPath =
    activeRepo !== null
      ? join(env.dataDir, 'repos', activeRepo.owner, activeRepo.repo)
      : session.project_dir;

  // Fetch file tree
  let fileTree: Awaited<ReturnType<typeof getProjectTree>>['children'];
  try {
    const tree = await getProjectTree(repoPath);
    fileTree = tree.children ?? [];
  } catch {
    fileTree = [];
  }

  // Send planning:complete
  const completeMessage: PlanningCompleteMessage = {
    type: 'planning:complete',
    data: {
      sessionId: String(session.id),
      repoPath,
      plan: {
        title: plan.title,
        summary: plan.description,
        phases,
      },
      fileTree,
      fileHints,
      issueContext: {
        title: session.issue_title ?? '',
        number: issueNumber,
        body: '',
        labels: [],
        url: '',
      },
    },
  };
  sendToClient(connectionId, completeMessage as ServerToClientMessage);

  // Send session:start so the coaching sidebar populates
  const sessionStartMessage = {
    type: 'session:start' as const,
    data: {
      sessionId: String(session.id),
      issueContext: {
        number: issueNumber,
        title: session.issue_title ?? '',
        url: '',
        labels: [] as Array<{ name: string; color: string }>,
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

  logger.info`Restored session ${String(session.id)} for issue #${String(issueNumber)}`;
}
