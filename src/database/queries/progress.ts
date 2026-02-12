import type { AppDatabase } from '../db.js';
import type { ProgressEvent } from '../../types/domain.js';

// ── Input Types ─────────────────────────────────────────────────────────────

export interface CreateProgressEventInput {
  phase_id: number;
  event_type: string;
  data?: string | null;
  created_at: string;
}

// ── Queries ─────────────────────────────────────────────────────────────────

/**
 * Inserts a new progress event into the `progress_events` table and returns
 * the full persisted row.
 *
 * The optional `data` field defaults to `null` when omitted.
 */
export async function createProgressEvent(
  db: AppDatabase,
  input: CreateProgressEventInput,
): Promise<ProgressEvent> {
  const result = await db
    .insertInto('progress_events')
    .values({
      phase_id: input.phase_id,
      event_type: input.event_type,
      data: input.data ?? null,
      created_at: input.created_at,
    } as never)
    .executeTakeFirstOrThrow();

  const id = Number(result.insertId);

  const row = await db
    .selectFrom('progress_events')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow();

  return row;
}

/**
 * Returns all progress events belonging to the given phase, ordered by
 * `created_at` ascending (chronological order). Returns an empty array if
 * no events exist for the phase.
 */
export async function getProgressEventsByPhase(
  db: AppDatabase,
  phaseId: number,
): Promise<ProgressEvent[]> {
  return db
    .selectFrom('progress_events')
    .selectAll()
    .where('phase_id', '=', phaseId)
    .orderBy('created_at', 'asc')
    .execute();
}
