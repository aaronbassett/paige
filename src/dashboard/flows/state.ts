// Dashboard Flow 1: Immediate state — Dreyfus assessments + aggregated stats
// Synchronous, <100ms target

import type { StatsPeriod, DashboardStateData } from '../../types/websocket.js';
import { getDatabase } from '../../database/db.js';
import { getAllDreyfus } from '../../database/queries/dreyfus.js';
import { getSessionCountByPeriod, getActionCountByPeriod } from '../../database/queries/actions.js';
import { getApiCallCountByPeriod, getApiCostByPeriod } from '../../logger/api-log.js';

/**
 * Assembles immediate dashboard state: Dreyfus stages + stats filtered by period.
 *
 * Loads all Dreyfus assessments and maps them to the entry format (stripping id,
 * evidence, assessed_at). Queries aggregated stats (session count, action count,
 * API call count, total cost) filtered by the given time period.
 *
 * Returns empty placeholder arrays for issues, challenges, and learning_materials
 * (these are populated by their respective async flows).
 */
export async function assembleState(statsPeriod: StatsPeriod): Promise<DashboardStateData> {
  const db = getDatabase();
  if (db === null) {
    throw new Error('Database not initialised');
  }

  // Load Dreyfus assessments and map to entry format
  const assessments = await getAllDreyfus(db);
  const dreyfus = assessments.map((a) => ({
    skill_area: a.skill_area,
    stage: a.stage,
    confidence: a.confidence,
  }));

  // Query stats filtered by period
  const [totalSessions, totalActions, totalApiCalls, totalCost] = await Promise.all([
    getSessionCountByPeriod(db, statsPeriod),
    getActionCountByPeriod(db, statsPeriod),
    getApiCallCountByPeriod(db, statsPeriod),
    getApiCostByPeriod(db, statsPeriod),
  ]);

  return {
    dreyfus,
    stats: {
      total_sessions: totalSessions,
      total_actions: totalActions,
      total_api_calls: totalApiCalls,
      total_cost: totalCost,
    },
    issues: [],
    challenges: [],
    learning_materials: [],
  };
}
