// WebSocket handler for practice:submit_solution — T363

import type { WebSocket as WsWebSocket } from 'ws';
import { getActiveSessionId } from '../../mcp/session.js';
import { handlePracticeReview } from '../../ui-apis/review.js';
import { broadcast } from '../server.js';
import type { PracticeSubmitSolutionData } from '../../types/websocket.js';

/**
 * Handles `practice:submit_solution` messages from Electron clients.
 * Calls the Practice Review API and broadcasts the response.
 */
export function handlePracticeSubmitSolution(
  _ws: WsWebSocket,
  data: unknown,
  _connectionId: string,
): void {
  const sessionId = getActiveSessionId();
  if (sessionId === null) return;

  const submitData = data as PracticeSubmitSolutionData;

  void handlePracticeReview(submitData, sessionId)
    .then((result) => {
      broadcast({
        type: 'practice:solution_review',
        data: {
          review: result.review,
          level: result.level,
          passed: result.passed,
          constraintsUnlocked: result.constraintsUnlocked,
        },
      });
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Review request failed';
      broadcast({ type: 'review:error', data: { error: message } });
    });
}
