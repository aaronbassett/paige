// Dashboard request dispatcher — handles dashboard:request and dashboard:refresh_issues
// Orchestrates 4 progressive flows: state, issues, challenges, learning materials

import { getLogger } from '../logger/logtape.js';
import type { StatsPeriod } from '../types/websocket.js';
import { getDatabase } from '../database/db.js';

const logger = getLogger(['paige', 'dashboard']);
import { logAction } from '../logger/action-log.js';
import { getActiveSessionId } from '../mcp/session.js';
import { broadcast } from '../websocket/server.js';
import { assembleState } from './flows/state.js';
import { assembleAndStreamInProgress } from './flows/in-progress.js';
import { assembleAndStreamIssues } from './flows/issues.js';
import { assembleChallenges } from './flows/challenges.js';
import { assembleLearningMaterials } from './flows/learning.js';

/** Result of the dashboard request with per-flow status. */
export interface DashboardResult {
  flowsCompleted: {
    state: boolean;
    in_progress: boolean;
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
 * Flows 2-4 run concurrently; each broadcasts/streams independently on completion.
 * Failures in individual flows do not block other flows.
 *
 * @param statsPeriod - Time period for stats aggregation
 * @param connectionId - WebSocket connection ID for per-client issue streaming
 * @param owner - Repository owner (for issue fetching)
 * @param repo - Repository name (for issue fetching)
 */
export async function handleDashboardRequest(
  statsPeriod: StatsPeriod,
  connectionId: string,
  owner: string,
  repo: string,
): Promise<DashboardResult> {
  const sessionId = getActiveSessionId();
  const flowStatus = {
    state: false,
    in_progress: false,
    issues: false,
    challenges: false,
    learning_materials: false,
  };

  // Flow 1: Immediate state — broadcast as separate messages matching frontend types
  // Frontend expects dashboard:dreyfus and dashboard:stats as separate messages
  try {
    const stateData = await assembleState(statsPeriod);

    // Map Dreyfus data to the format frontend expects: { axes: [{ skill, level }] }
    const dreyfusAxes = stateData.dreyfus.map((d) => ({
      skill: d.skill_area,
      level: Math.min(5, Math.max(1, Math.round(d.confidence * 5))) as 1 | 2 | 3 | 4 | 5,
    }));
    broadcast({ type: 'dashboard:dreyfus', data: { axes: dreyfusAxes } });

    // Broadcast stats in the rich StatPayload format
    broadcast({
      type: 'dashboard:stats',
      data: stateData.stats,
    });

    flowStatus.state = true;
  } catch (err) {
    logger.error`Flow 1 (state) failed: ${err}`;
  }

  // Flows 2-4: Run concurrently, each broadcasts/streams independently
  // Flow 2: In-progress items + issues (sequential dependency)
  // In-progress runs first to get exclusion set, then issues uses it
  const inProgressAndIssues = (async () => {
    let excludeNumbers = new Set<number>();
    try {
      excludeNumbers = await assembleAndStreamInProgress(owner, repo, connectionId);
      flowStatus.in_progress = true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'In-progress flow failed';
      logger.error`Flow 2a (in-progress) failed: ${message}`;
    }

    try {
      await assembleAndStreamIssues(owner, repo, connectionId, excludeNumbers);
      flowStatus.issues = true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Issues flow failed';
      logger.error`Flow 2b (issues) failed: ${message}`;
    }
  })();

  const flowPromises = [
    inProgressAndIssues,

    // Flow 3: Active challenges
    assembleChallenges()
      .then((data) => {
        broadcast({ type: 'dashboard:challenges', data });
        flowStatus.challenges = true;
      })
      .catch((err: unknown) => {
        logger.error`Flow 3 (challenges) failed: ${err}`;
      }),

    // Flow 4: Learning materials (frontend expects 'dashboard:materials')
    assembleLearningMaterials()
      .then((data) => {
        if (data !== null) {
          broadcast({ type: 'dashboard:materials', data });
        }
        flowStatus.learning_materials = true;
      })
      .catch((err: unknown) => {
        logger.error`Flow 4 (learning) failed: ${err}`;
      }),
  ];

  await Promise.all(flowPromises);

  // Log dashboard_loaded action with flow statuses (only if a session is active)
  const db = getDatabase();
  if (db !== null && sessionId !== null) {
    await logAction(db as never, sessionId, 'dashboard_loaded', { ...flowStatus });
  }

  return { flowsCompleted: flowStatus };
}

/**
 * Handles a dashboard:refresh_issues request (re-runs Flow 2 only).
 * Streams individual issues to the requesting client, then sends completion.
 *
 * @param connectionId - WebSocket connection ID for per-client issue streaming
 * @param owner - Repository owner
 * @param repo - Repository name
 */
export async function handleDashboardRefreshIssues(
  connectionId: string,
  owner: string,
  repo: string,
): Promise<void> {
  try {
    const excludeNumbers = await assembleAndStreamInProgress(owner, repo, connectionId);
    await assembleAndStreamIssues(owner, repo, connectionId, excludeNumbers);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Issues refresh failed';
    logger.error`Issues refresh failed: ${message}`;
  }
}
