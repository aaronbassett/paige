// WebSocket handler for review:request messages.
// Delegates to the multi-turn review agent and broadcasts the result.

import type { WebSocket as WsWebSocket } from 'ws';
import type { ReviewRequestData } from '../../types/websocket.js';
import { getLogger } from '../../logger/logtape.js';
import { getActiveRepo, getActiveSessionId } from '../../mcp/session.js';
import { getDatabase } from '../../database/db.js';

const logger = getLogger(['paige', 'ws-handler', 'review']);
import { loadEnv } from '../../config/env.js';
import { broadcast } from '../server.js';
import { runReviewAgent } from '../../review/agent.js';

/**
 * Handles `review:request` messages from Electron clients.
 *
 * Runs the multi-turn review agent in the background and broadcasts
 * either `review:result` on success or `review:error` on failure.
 */
export function handleReviewRequest(_ws: WsWebSocket, data: unknown, _connectionId: string): void {
  const { scope, activeFilePath, openFilePaths } = data as ReviewRequestData;

  void (async () => {
    const activeRepo = getActiveRepo();
    const env = loadEnv();
    const projectDir = activeRepo
      ? `${env.dataDir}/repos/${activeRepo.owner}/${activeRepo.repo}`
      : env.dataDir;

    const sessionId = getActiveSessionId();
    const db = getDatabase();

    // Get phase info from DB if available (phases belong to plans, plans belong to sessions)
    let phaseTitle: string | undefined;
    let phaseDescription: string | undefined;

    if (db !== null && sessionId !== null) {
      const activePlan = await db
        .selectFrom('plans')
        .selectAll()
        .where('session_id', '=', sessionId)
        .where('is_active', '=', 1)
        .executeTakeFirst();

      if (activePlan) {
        const activePhase = await db
          .selectFrom('phases')
          .selectAll()
          .where('plan_id', '=', activePlan.id)
          .where('status', '=', 'active')
          .executeTakeFirst();

        if (activePhase) {
          phaseTitle = activePhase.title;
          phaseDescription = activePhase.description;
        }
      }
    }

    const request: Parameters<typeof runReviewAgent>[0] = { scope, projectDir };
    if (phaseTitle !== undefined) request.phaseTitle = phaseTitle;
    if (phaseDescription !== undefined) request.phaseDescription = phaseDescription;
    if (activeFilePath !== undefined && activeFilePath !== null)
      request.activeFilePath = activeFilePath;
    if (openFilePaths !== undefined && openFilePaths !== null)
      request.openFilePaths = [...openFilePaths];

    const result = await runReviewAgent(request);

    broadcast({
      type: 'review:result',
      data: result,
    } as never);
  })().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Review failed';
    logger.error`Review agent failed: ${message}`;
    broadcast({
      type: 'review:error',
      data: { error: message },
    } as never);
  });
}
