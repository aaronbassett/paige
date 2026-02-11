// Dashboard Flow 1: Immediate state — Dreyfus assessments + aggregated stats
// Synchronous, <100ms target

import type { StatsPeriod, DashboardStateData } from '../../types/websocket.js';

/**
 * Assembles immediate dashboard state: Dreyfus stages + stats filtered by period.
 */
export function assembleState(_statsPeriod: StatsPeriod): Promise<DashboardStateData> {
  return Promise.reject(new Error('Not implemented'));
}
