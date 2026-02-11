// Dashboard request dispatcher — handles dashboard:request and dashboard:refresh_issues
// Orchestrates 4 progressive flows: state, issues, challenges, learning materials

import type { StatsPeriod } from '../types/websocket.js';

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
 */
export function handleDashboardRequest(_statsPeriod: StatsPeriod): Promise<DashboardResult> {
  return Promise.reject(new Error('Not implemented'));
}

/**
 * Handles a dashboard:refresh_issues request (re-runs Flow 2 only).
 */
export function handleDashboardRefreshIssues(): Promise<void> {
  return Promise.reject(new Error('Not implemented'));
}
