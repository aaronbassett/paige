// WebSocket handlers for repos:list and repos:activity messages.
// Fetches GitHub repository data and streams it to the requesting client.

import type { WebSocket as WsWebSocket } from 'ws';
import { fetchUserRepos, fetchRepoActivity } from '../../github/repos.js';
import { sendToClient } from '../server.js';
import type {
  ReposActivityRequestData,
  ReposListResponseMessage,
  RepoActivityResponseMessage,
} from '../../types/websocket.js';

/**
 * Handles `repos:list` messages from Electron clients.
 * Fetches the authenticated user's repositories and sends back a
 * `repos:list_response` message with the full list.
 */
export async function handleReposList(
  _ws: WsWebSocket,
  _data: unknown,
  connectionId: string,
): Promise<void> {
  const repos = await fetchUserRepos();

  sendToClient(connectionId, {
    type: 'repos:list_response',
    data: { repos },
  } as ReposListResponseMessage);
}

/**
 * Handles `repos:activity` messages from Electron clients.
 * For each repo in the request, fetches recent activity and sends an
 * individual `repo:activity` message as each resolves. This allows the
 * frontend to progressively render activity data.
 */
export async function handleReposActivity(
  _ws: WsWebSocket,
  data: unknown,
  connectionId: string,
): Promise<void> {
  const { repos } = data as ReposActivityRequestData;

  // Fetch activity for all repos concurrently, sending each result as it arrives
  const promises = repos.map(async (repoFullName) => {
    try {
      const activities = await fetchRepoActivity(repoFullName);

      sendToClient(connectionId, {
        type: 'repo:activity',
        data: { repo: repoFullName, activities },
      } as RepoActivityResponseMessage);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `[ws-handler:repos] Failed to fetch activity for ${repoFullName}:`,
        err instanceof Error ? err.message : err,
      );

      // Send empty activities on failure so the frontend can still render
      sendToClient(connectionId, {
        type: 'repo:activity',
        data: { repo: repoFullName, activities: [] },
      } as RepoActivityResponseMessage);
    }
  });

  await Promise.all(promises);
}
