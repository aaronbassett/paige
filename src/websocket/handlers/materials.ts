// WebSocket handlers for learning materials messages — Task 8
// Handles materials:view, materials:complete, materials:dismiss, materials:list

import type { WebSocket as WsWebSocket } from 'ws';
import { getDatabase } from '../../database/db.js';
import {
  getLearningMaterial,
  getLearningMaterialsBySession,
  incrementViewCount,
  updateLearningMaterialStatus,
} from '../../database/queries/learning-materials.js';
import { logAction } from '../../logger/action-log.js';
import { getLogger } from '../../logger/logtape.js';
import { getActiveSessionId } from '../../mcp/session.js';

const logger = getLogger(['paige', 'ws-handler', 'materials']);
import { verifyAnswer } from '../../coaching/agents/verify-answer.js';
import { broadcast } from '../server.js';
import type { LearningMaterial } from '../../types/domain.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts a backend LearningMaterial row to the camelCase wire format
 * expected by the Electron UI.
 */
function toWireMaterial(m: LearningMaterial): Record<string, unknown> {
  return {
    id: m.id,
    type: m.type,
    url: m.url,
    title: m.title,
    description: m.description,
    thumbnailUrl: m.thumbnail_url,
    question: m.question,
    viewCount: m.view_count,
    status: m.status,
    createdAt: m.created_at,
  };
}

/**
 * Logs an action to the database, swallowing any errors to avoid
 * disrupting the main handler flow.
 */
function safeLogAction(
  actionType: Parameters<typeof logAction>[2],
  data?: Record<string, unknown>,
): void {
  const db = getDatabase();
  const sessionId = getActiveSessionId();
  if (db !== null && sessionId !== null) {
    logAction(db, sessionId, actionType, data).catch((err: unknown) => {
      logger.error`Failed to log action "${actionType}": ${err}`;
    });
  }
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/**
 * Handles `materials:view` messages from Electron clients.
 * Increments the view count, logs the action, sends the updated material
 * back to the client, and sends `materials:open_url` so the renderer
 * opens the URL in the system browser.
 */
export function handleMaterialsView(_ws: WsWebSocket, data: unknown, _connectionId: string): void {
  const { id } = data as { id: number };

  const db = getDatabase();
  const sessionId = getActiveSessionId();
  if (db === null || sessionId === null) return;

  void incrementViewCount(db, id)
    .then((material) => {
      if (!material) return;

      safeLogAction('learning_material_viewed', { materialId: id, url: material.url });

      broadcast({
        type: 'materials:updated',
        data: {
          id: material.id,
          viewCount: material.view_count,
          status: material.status,
        },
      });

      broadcast({
        type: 'materials:open_url',
        data: { url: material.url },
      });
    })
    .catch((err: unknown) => {
      logger.error`View failed: ${err}`;
    });
}

/**
 * Handles `materials:complete` messages from Electron clients.
 * Calls the verify-answer agent to check the developer's answer.
 * If correct, marks the material as completed. Sends the result back.
 */
export function handleMaterialsComplete(
  _ws: WsWebSocket,
  data: unknown,
  _connectionId: string,
): void {
  const { id, answer } = data as { id: number; answer: string };

  const db = getDatabase();
  const sessionId = getActiveSessionId();
  if (db === null || sessionId === null) return;

  void getLearningMaterial(db, id)
    .then(async (material) => {
      if (!material) return;

      const result = await verifyAnswer({
        materialTitle: material.title,
        materialUrl: material.url,
        materialType: material.type,
        question: material.question,
        answer,
        sessionId,
      });

      safeLogAction('learning_material_answer_checked', {
        materialId: id,
        correct: result.correct,
      });

      if (result.correct) {
        const updated = await updateLearningMaterialStatus(db, id, 'completed');

        safeLogAction('learning_material_completed', { materialId: id });

        if (updated) {
          broadcast({
            type: 'materials:updated',
            data: {
              id: updated.id,
              viewCount: updated.view_count,
              status: updated.status,
            },
          });
        }
      }

      broadcast({
        type: 'materials:complete_result',
        data: {
          id,
          correct: result.correct,
          message: result.feedback ?? undefined,
        },
      });
    })
    .catch((err: unknown) => {
      logger.error`Complete failed: ${err}`;
      broadcast({
        type: 'materials:complete_result',
        data: { id, correct: false, message: 'Verification failed. Please try again.' },
      });
    });
}

/**
 * Handles `materials:dismiss` messages from Electron clients.
 * Marks the material status as dismissed and logs the action.
 */
export function handleMaterialsDismiss(
  _ws: WsWebSocket,
  data: unknown,
  _connectionId: string,
): void {
  const { id } = data as { id: number };

  const db = getDatabase();
  const sessionId = getActiveSessionId();
  if (db === null || sessionId === null) return;

  void updateLearningMaterialStatus(db, id, 'dismissed')
    .then((updated) => {
      if (!updated) return;

      safeLogAction('learning_material_dismissed', { materialId: id });

      broadcast({
        type: 'materials:updated',
        data: {
          id: updated.id,
          viewCount: updated.view_count,
          status: updated.status,
        },
      });
    })
    .catch((err: unknown) => {
      logger.error`Dismiss failed: ${err}`;
    });
}

/**
 * Handles `materials:list` messages from Electron clients.
 * Returns all pending learning materials for the active session
 * via a `dashboard:materials` message.
 */
export function handleMaterialsList(_ws: WsWebSocket, _data: unknown, _connectionId: string): void {
  const db = getDatabase();
  const sessionId = getActiveSessionId();
  if (db === null || sessionId === null) return;

  void getLearningMaterialsBySession(db, sessionId, 'pending')
    .then((materials) => {
      broadcast({
        type: 'dashboard:materials',
        data: {
          materials: materials.map(toWireMaterial),
        },
      });
    })
    .catch((err: unknown) => {
      logger.error`List failed: ${err}`;
    });
}
