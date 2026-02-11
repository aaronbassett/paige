// Dashboard Flow 2: GitHub issues with Haiku suitability assessment

import type { DashboardIssuesData } from '../../types/websocket.js';

/**
 * Fetches open GitHub issues, assesses suitability with Haiku, and returns ranked results.
 */
export function assembleIssues(_sessionId: number): Promise<DashboardIssuesData> {
  return Promise.reject(new Error('Not implemented'));
}
