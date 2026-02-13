// Dashboard request dispatcher — handles dashboard:request and dashboard:refresh_issues
// Orchestrates 4 progressive flows: state, issues, challenges, learning materials

import type { StatsPeriod } from '../types/websocket.js';
import { getDatabase } from '../database/db.js';
import { logAction } from '../logger/action-log.js';
import { getActiveSessionId } from '../mcp/session.js';
import { broadcast } from '../websocket/server.js';
import { assembleState } from './flows/state.js';
import { assembleAndStreamIssues } from './flows/issues.js';
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

    // Map stats to the format frontend expects: { period, stats: [{ label, value, change }] }
    const periodLabel =
      statsPeriod === '7d' ? 'this_week' : statsPeriod === '30d' ? 'this_month' : 'today';
    broadcast({
      type: 'dashboard:stats',
      data: {
        period: periodLabel,
        stats: [
          { label: 'Sessions', value: stateData.stats.total_sessions, change: 0 },
          { label: 'Actions', value: stateData.stats.total_actions, change: 0 },
          { label: 'API Calls', value: stateData.stats.total_api_calls, change: 0 },
          { label: 'Cost', value: stateData.stats.total_cost, change: 0 },
        ],
      },
    });

    flowStatus.state = true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[dashboard] Flow 1 (state) failed:', err);
  }

  // Flows 2-4: Run concurrently, each broadcasts/streams independently
  const flowPromises = [
    // Flow 2: GitHub issues — streamed per-issue to the requesting client
    assembleAndStreamIssues(owner, repo, connectionId)
      .then(() => {
        flowStatus.issues = true;
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Issues flow failed';
        // eslint-disable-next-line no-console
        console.error('[dashboard] Flow 2 (issues) failed:', message);
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

    // Flow 4: Learning materials (frontend expects 'dashboard:materials')
    assembleLearningMaterials()
      .then((data) => {
        if (data !== null) {
          broadcast({ type: 'dashboard:materials', data });
        }
        flowStatus.learning_materials = true;
      })
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('[dashboard] Flow 4 (learning) failed:', err);
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
    await assembleAndStreamIssues(owner, repo, connectionId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Issues refresh failed';
    // eslint-disable-next-line no-console
    console.error('[dashboard] Issues refresh failed:', message);
  }
}
