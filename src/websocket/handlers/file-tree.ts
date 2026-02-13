// WebSocket handler for fs:request_tree — returns the project file tree on demand.
// Sent by the Electron UI when the IDE view mounts, so the file explorer
// populates even if the initial fs:tree from connection:hello was missed.

import { join } from 'node:path';
import { WebSocket as WsWebSocket } from 'ws';

import { getProjectTree } from '../../file-system/tree.js';
import { getActiveRepo } from '../../mcp/session.js';
import { loadEnv } from '../../config/env.js';

/**
 * Sends a typed JSON message to the client.
 * No-ops if the socket is not in the OPEN state.
 */
function send(ws: WsWebSocket, type: string, payload: unknown): void {
  if (ws.readyState === WsWebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
  }
}

/**
 * Handles `fs:request_tree` messages from the Electron client.
 * Resolves the correct project directory (active repo clone or env fallback)
 * and responds with an `fs:tree` message containing the tree.
 */
export async function handleFsRequestTree(
  ws: WsWebSocket,
  _data: unknown,
  _connectionId: string,
): Promise<void> {
  const env = loadEnv();
  const activeRepo = getActiveRepo();

  const projectDir =
    activeRepo !== null
      ? join(env.dataDir, 'repos', activeRepo.owner, activeRepo.repo)
      : env.projectDir;

  try {
    const tree = await getProjectTree(projectDir);
    send(ws, 'fs:tree', { root: tree });
  } catch (err: unknown) {
    // eslint-disable-next-line no-console
    console.error('[ws-handler:file-tree] Failed to send file tree:', err);
  }
}
