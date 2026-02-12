// WebSocket handlers for dashboard messages — T392, T394

import type { WebSocket as WsWebSocket } from 'ws';
import { handleDashboardRequest, handleDashboardRefreshIssues } from '../../dashboard/handler.js';
import type { DashboardRequestData } from '../../types/websocket.js';

/**
 * Handles `dashboard:request` messages from Electron clients.
 * Triggers the 4 progressive dashboard flows (state, issues, challenges, learning).
 */
export function handleDashboardRequestWs(
  _ws: WsWebSocket,
  data: unknown,
  _connectionId: string,
): void {
  const { statsPeriod } = data as DashboardRequestData;

  void handleDashboardRequest(statsPeriod).catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[ws-handler:dashboard] Dashboard request failed:', err);
  });
}

/**
 * Handles `dashboard:refresh_issues` messages from Electron clients.
 * Re-runs the issues flow only (Flow 2).
 */
export function handleDashboardRefreshIssuesWs(
  _ws: WsWebSocket,
  _data: unknown,
  _connectionId: string,
): void {
  void handleDashboardRefreshIssues().catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[ws-handler:dashboard] Dashboard refresh issues failed:', err);
  });
}
