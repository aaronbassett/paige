import { EventEmitter } from 'node:events';
import type { Kysely } from 'kysely';
import type { ActionType, DatabaseTables } from '../types/domain.js';

// ── Event Emitter ──────────────────────────────────────────────────────────────

/**
 * Emits 'action' events whenever an action is logged.
 * Used by the Observer system to subscribe to session activity.
 */
export const actionEvents = new EventEmitter();

export interface ActionEventPayload {
  sessionId: number;
  actionType: ActionType;
  data: Record<string, unknown> | undefined;
  createdAt: string;
}

// ── Action Logging ─────────────────────────────────────────────────────────────

/**
 * Inserts an action log entry into the database and emits an event.
 */
export async function logAction(
  db: Kysely<DatabaseTables>,
  sessionId: number,
  actionType: ActionType,
  data?: Record<string, unknown>,
): Promise<void> {
  const createdAt = new Date().toISOString();
  const serializedData = data !== undefined ? JSON.stringify(data) : null;

  await db
    .insertInto('action_log')
    .values({
      session_id: sessionId,
      action_type: actionType,
      data: serializedData,
      created_at: createdAt,
    } as never)
    .execute();

  const payload: ActionEventPayload = {
    sessionId,
    actionType,
    data,
    createdAt,
  };
  actionEvents.emit('action', payload);
}

// ── Buffer Summary Timer (Stub) ────────────────────────────────────────────────
// Full implementation in Phase 6 (US4). This skeleton provides the timer
// lifecycle so other modules can depend on the interface now.

let bufferTimerId: ReturnType<typeof setInterval> | null = null;

/**
 * Starts a 30-second interval that calls the provided callback.
 * Used to trigger periodic buffer summaries for the Observer.
 */
export function startBufferSummaryTimer(callback: () => void): void {
  stopBufferSummaryTimer();
  bufferTimerId = setInterval(callback, 30_000);
}

/**
 * Stops the buffer summary timer if one is running.
 */
export function stopBufferSummaryTimer(): void {
  if (bufferTimerId !== null) {
    clearInterval(bufferTimerId);
    bufferTimerId = null;
  }
}
