// Dashboard Flow 1: Immediate state — Dreyfus assessments + aggregated stats
// Synchronous, <100ms target

import type { StatsPeriod, DashboardStateData } from '../../types/websocket.js';
import { getDatabase } from '../../database/db.js';
import { getAllDreyfus } from '../../database/queries/dreyfus.js';
import { generateDummyStats } from '../../database/queries/stats.js';

/**
 * Assembles immediate dashboard state: Dreyfus stages + stats filtered by period.
 *
 * Loads all Dreyfus assessments and maps them to the entry format (stripping id,
 * evidence, assessed_at). Generates dummy stats for all 25 stat types scaled by
 * the given time period (will be replaced with real queries once data flows are
 * complete).
 *
 * Returns empty placeholder arrays for issues, challenges, and learning_materials
 * (these are populated by their respective async flows).
 */
export async function assembleState(statsPeriod: StatsPeriod): Promise<DashboardStateData> {
  const db = getDatabase();
  if (db === null) {
    throw new Error('Database not initialized. Cannot assemble dashboard state.');
  }

  // Load Dreyfus assessments and map to entry format
  const assessments = await getAllDreyfus(db);
  const dreyfus = assessments.map((a) => ({
    skill_area: a.skill_area,
    stage: a.stage,
    confidence: a.confidence,
  }));

  // Generate dummy stats for all 25 stat types
  const stats = generateDummyStats(statsPeriod);

  return {
    dreyfus,
    stats: {
      period: statsPeriod,
      stats,
    },
    issues: [],
    challenges: [],
    learning_materials: [],
  };
}
