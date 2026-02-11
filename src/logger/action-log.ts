import { EventEmitter } from 'node:events';
import type { Kysely } from 'kysely';
import { getDirtyPaths, getBuffer } from '../file-system/buffer-cache.js';
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

// ── Buffer Log State ────────────────────────────────────────────────────────

interface BufferLogState {
  lastLoggedCharCount: number;
  editCountSinceLastLog: number;
}

/** Module-level state tracking per-file buffer logging metrics. */
const bufferLogState = new Map<string, BufferLogState>();

/**
 * Clears the buffer log state map. Exported for testing purposes.
 */
export function resetBufferLogState(): void {
  bufferLogState.clear();
}

// ── Buffer Summary Logging ──────────────────────────────────────────────────

/**
 * Logs a `buffer_summary` action for each dirty buffer.
 * Tracks lastLoggedCharCount per file for significant change detection.
 */
export async function logBufferSummaries(
  db: Kysely<DatabaseTables>,
  sessionId: number,
): Promise<void> {
  const dirtyPaths = getDirtyPaths();
  if (dirtyPaths.length === 0) {
    return;
  }

  for (const path of dirtyPaths) {
    const buffer = getBuffer(path);
    if (buffer === null) {
      continue;
    }

    const charCount = buffer.content.length;
    const state = bufferLogState.get(path);
    const lastLoggedCharCount = state?.lastLoggedCharCount ?? 0;
    const editCountSinceLastLog = state?.editCountSinceLastLog ?? 0;
    const charDelta = charCount - lastLoggedCharCount;

    await logAction(db, sessionId, 'buffer_summary', {
      path,
      editCount: editCountSinceLastLog,
      charDelta,
      charCount,
    });

    bufferLogState.set(path, {
      lastLoggedCharCount: charCount,
      editCountSinceLastLog: 0,
    });
  }
}

/**
 * Checks if a buffer update represents a significant change (>50% or >500 chars)
 * relative to the last logged char count. Logs `buffer_significant_change` if so.
 */
export async function checkSignificantChange(
  db: Kysely<DatabaseTables>,
  sessionId: number,
  path: string,
  newCharCount: number,
): Promise<boolean> {
  let state = bufferLogState.get(path);
  if (state === undefined) {
    state = { lastLoggedCharCount: 0, editCountSinceLastLog: 0 };
    bufferLogState.set(path, state);
  }

  state.editCountSinceLastLog++;

  const absoluteDelta = Math.abs(newCharCount - state.lastLoggedCharCount);

  // Determine if the change is significant:
  // - When lastLoggedCharCount is 0 (no baseline), any non-zero content is significant
  // - Otherwise, check absolute threshold (>500 chars) or percentage threshold (>50%)
  let isSignificant = false;
  if (state.lastLoggedCharCount === 0) {
    isSignificant = newCharCount > 0;
  } else {
    const percentage = absoluteDelta / state.lastLoggedCharCount;
    isSignificant = absoluteDelta > 500 || percentage > 0.5;
  }

  if (isSignificant) {
    await logAction(db, sessionId, 'buffer_significant_change', {
      path,
      previousCharCount: state.lastLoggedCharCount,
      newCharCount,
      delta: absoluteDelta,
    });

    state.lastLoggedCharCount = newCharCount;
    state.editCountSinceLastLog = 0;

    return true;
  }

  return false;
}

// ── Buffer Summary Timer ───────────────────────────────────────────────────────

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
