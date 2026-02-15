// WebSocket handler for connection:hello messages from Electron clients.
// Responds with connection:init containing session ID, capabilities, and feature flags.

import { randomUUID } from 'node:crypto';
import { WebSocket as WsWebSocket } from 'ws';

import { getLogger } from '../../logger/logtape.js';
import type { ConnectionInitData } from '../../types/websocket.js';

const logger = getLogger(['paige', 'ws-handler', 'connection']);
import { getCollection } from '../../memory/chromadb.js';
import { loadEnv } from '../../config/env.js';
import { getProjectTree } from '../../file-system/tree.js';
import { handleDashboardRequest } from '../../dashboard/handler.js';
import { getActiveRepo } from '../../mcp/session.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Check if ChromaDB is available by trying to get the collection.
 */
function isChromaDBAvailable(): boolean {
  try {
    const collection = getCollection();
    return collection !== null;
  } catch {
    return false;
  }
}

/**
 * Sends a typed JSON message to the client.
 * No-ops if the socket is not in the OPEN state.
 * Sends in the format expected by Electron UI: { type, payload, timestamp }
 */
function send(ws: WsWebSocket, type: string, payload: unknown): void {
  if (ws.readyState === WsWebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

/**
 * Handles `connection:hello` messages from Electron clients.
 * Responds with `connection:init` containing a fresh session UUID,
 * capability flags, and feature flags. Then sends the initial file tree
 * so the file explorer populates immediately.
 */
export async function handleConnectionHello(
  ws: WsWebSocket,
  _data: unknown,
  connectionId: string,
): Promise<void> {
  const env = loadEnv();

  const initData: ConnectionInitData = {
    sessionId: randomUUID(),
    projectDir: env.projectDir,
    capabilities: {
      chromadb_available: isChromaDBAvailable(),
      github_api_available: !!process.env['GITHUB_TOKEN'],
    },
    featureFlags: {
      observer_enabled: false,
      practice_mode_enabled: false,
    },
  };

  send(ws, 'connection:init', initData);

  // Send initial file tree so the explorer populates on startup
  try {
    const tree = await getProjectTree(env.projectDir);
    send(ws, 'fs:tree', { root: tree });
  } catch (err: unknown) {
    logger.error`Failed to send initial file tree: ${err}`;
  }

  // Trigger dashboard data load so the dashboard populates on startup
  // This runs async — individual flows broadcast/stream as they complete
  const repo = getActiveRepo();
  handleDashboardRequest('last_week', connectionId, repo?.owner ?? '', repo?.repo ?? '').catch(
    (err: unknown) => {
      logger.error`Failed to load initial dashboard data: ${err}`;
    },
  );
}
