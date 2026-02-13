// WebSocket handlers for dashboard messages — T392, T394

import type { WebSocket as WsWebSocket } from 'ws';
import { handleDashboardRequest, handleDashboardRefreshIssues } from '../../dashboard/handler.js';
import { getActiveRepo } from '../../mcp/session.js';
import type { DashboardRequestData, StatsPeriod } from '../../types/websocket.js';

/**
 * Handles `dashboard:request` messages from Electron clients.
 * Triggers the 4 progressive dashboard flows (state, issues, challenges, learning).
 *
 * The connectionId is passed through so Flow 2 (issues) can stream
 * individual issues to the requesting client rather than broadcasting.
 */
export function handleDashboardRequestWs(
  _ws: WsWebSocket,
  data: unknown,
  connectionId: string,
): void {
  const { statsPeriod } = data as DashboardRequestData;
  const repo = getActiveRepo();

  // Default to empty strings if no repo is selected yet — the issues flow
  // will gracefully handle this by checking for a valid Octokit client.
  const owner = repo?.owner ?? '';
  const repoName = repo?.repo ?? '';

  void handleDashboardRequest(statsPeriod, connectionId, owner, repoName).catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[ws-handler:dashboard] Dashboard request failed:', err);
  });
}

/**
 * Handles `dashboard:stats_period` messages from Electron clients.
 * Triggered when Dashboard mounts or when user switches the period dropdown.
 * Extracts `period` (matching the frontend field name) and delegates to handleDashboardRequest.
 */
export function handleDashboardStatsPeriodWs(
  _ws: WsWebSocket,
  data: unknown,
  connectionId: string,
): void {
  const { period } = data as { period: StatsPeriod };
  const repo = getActiveRepo();
  const owner = repo?.owner ?? '';
  const repoName = repo?.repo ?? '';

  void handleDashboardRequest(period, connectionId, owner, repoName).catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[ws-handler:dashboard] Stats period change failed:', err);
  });
}

/**
 * Handles `dashboard:refresh_issues` messages from Electron clients.
 * Re-runs the issues flow only (Flow 2), streaming to the requesting client.
 */
export function handleDashboardRefreshIssuesWs(
  _ws: WsWebSocket,
  _data: unknown,
  connectionId: string,
): void {
  const repo = getActiveRepo();
  const owner = repo?.owner ?? '';
  const repoName = repo?.repo ?? '';

  void handleDashboardRefreshIssues(connectionId, owner, repoName).catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[ws-handler:dashboard] Dashboard refresh issues failed:', err);
  });
}
