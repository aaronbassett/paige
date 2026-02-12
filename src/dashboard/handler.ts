// Dashboard request dispatcher — handles dashboard:request and dashboard:refresh_issues
// Orchestrates 4 progressive flows: state, issues, challenges, learning materials

import type { StatsPeriod } from '../types/websocket.js';
import { getDatabase } from '../database/db.js';
import { logAction } from '../logger/action-log.js';
import { getActiveSessionId } from '../mcp/session.js';
import { broadcast } from '../websocket/server.js';
import { assembleState } from './flows/state.js';
import { assembleIssues } from './flows/issues.js';
import { assembleChallenges } from './flows/challenges.js';
import { assembleLearningMaterials } from './flows/learning.js';

/** Result of the dashboard request with per-flow status. */
export interface DashboardResult {
  flowsCompleted: {
    state: boolean;
    issues: boolean;
    challenges: boolean;
    learning_materials: boolean;
  };
}

/**
 * Handles a dashboard:request by broadcasting immediate state and kicking off
 * 3 async flows (issues, challenges, learning materials).
 *
 * Flow 1 (state) runs synchronously and broadcasts immediately.
 * Flows 2-4 run concurrently; each broadcasts independently on completion.
 * Failures in individual flows do not block other flows.
 */
export async function handleDashboardRequest(statsPeriod: StatsPeriod): Promise<DashboardResult> {
  const sessionId = getActiveSessionId() ?? 0;
  const flowStatus = {
    state: false,
    issues: false,
    challenges: false,
    learning_materials: false,
  };

  // Flow 1: Immediate state (Dreyfus + stats) — broadcast synchronously
  try {
    const stateData = await assembleState(statsPeriod);
    broadcast({ type: 'dashboard:state', data: stateData });
    flowStatus.state = true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[dashboard] Flow 1 (state) failed:', err);
  }

  // Flows 2-4: Run concurrently, each broadcasts independently
  const flowPromises = [
    // Flow 2: GitHub issues with suitability
    assembleIssues(sessionId)
      .then((data) => {
        broadcast({ type: 'dashboard:issues', data });
        flowStatus.issues = true;
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Issues flow failed';
        broadcast({ type: 'dashboard:issues_error', data: { error: message } });
      }),

    // Flow 3: Active challenges
    assembleChallenges()
      .then((data) => {
        broadcast({ type: 'dashboard:challenges', data });
        flowStatus.challenges = true;
      })
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('[dashboard] Flow 3 (challenges) failed:', err);
      }),

    // Flow 4: Learning materials
    assembleLearningMaterials()
      .then((data) => {
        if (data !== null) {
          broadcast({ type: 'dashboard:learning_materials', data });
        }
        flowStatus.learning_materials = true;
      })
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('[dashboard] Flow 4 (learning) failed:', err);
      }),
  ];

  await Promise.all(flowPromises);

  // Log dashboard_loaded action with flow statuses
  const db = getDatabase();
  if (db !== null) {
    await logAction(db as never, sessionId, 'dashboard_loaded', { ...flowStatus });
  }

  return { flowsCompleted: flowStatus };
}

/**
 * Handles a dashboard:refresh_issues request (re-runs Flow 2 only).
 * Broadcasts dashboard:issues on success or dashboard:issues_error on failure.
 */
export async function handleDashboardRefreshIssues(): Promise<void> {
  const sessionId = getActiveSessionId() ?? 0;

  try {
    const data = await assembleIssues(sessionId);
    broadcast({ type: 'dashboard:issues', data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Issues refresh failed';
    broadcast({ type: 'dashboard:issues_error', data: { error: message } });
  }
}
