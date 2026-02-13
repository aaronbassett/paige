// Dashboard Flow 1: Immediate state — Dreyfus assessments + aggregated stats
// Synchronous, <100ms target

import type { StatsPeriod, DashboardStateData } from '../../types/websocket.js';
import type { DreyfusStage } from '../../types/domain.js';
import { getDatabase } from '../../database/db.js';
import { getAllDreyfus } from '../../database/queries/dreyfus.js';
import { generateDummyStats } from '../../database/queries/stats.js';

/** Default skill areas shown when no Dreyfus assessments exist yet. */
const DEFAULT_DREYFUS: Array<{ skill_area: string; stage: DreyfusStage; confidence: number }> = [
  { skill_area: 'TypeScript', stage: 'Novice', confidence: 0.2 },
  { skill_area: 'React', stage: 'Novice', confidence: 0.2 },
  { skill_area: 'Testing', stage: 'Novice', confidence: 0.2 },
  { skill_area: 'Git', stage: 'Novice', confidence: 0.2 },
  { skill_area: 'State Management', stage: 'Novice', confidence: 0.2 },
  { skill_area: 'Error Handling', stage: 'Novice', confidence: 0.2 },
];

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

  // Load Dreyfus assessments and merge with defaults for missing skill areas.
  // This ensures the radar chart always has 3+ axes (spider chart requires 3).
  const assessments = await getAllDreyfus(db);
  const realEntries = assessments.map((a) => ({
    skill_area: a.skill_area,
    stage: a.stage,
    confidence: a.confidence,
  }));
  const realSkills = new Set(realEntries.map((e) => e.skill_area));
  const fillers = DEFAULT_DREYFUS.filter((d) => !realSkills.has(d.skill_area));
  const dreyfus = [...realEntries, ...fillers];

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
