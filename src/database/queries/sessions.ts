import type { AppDatabase } from '../db.js';
import type { Session } from '../../types/domain.js';

// ── Input Types ─────────────────────────────────────────────────────────────

export interface CreateSessionInput {
  project_dir: string;
  status: 'active' | 'completed';
  started_at: string;
  issue_number?: number | null;
  issue_title?: string | null;
  last_activity_at?: string;
}

export interface UpdateSessionInput {
  status?: 'active' | 'completed';
  ended_at?: string | null;
  last_activity_at?: string;
  issue_number?: number | null;
  issue_title?: string | null;
}

// ── Queries ─────────────────────────────────────────────────────────────────

/**
 * Inserts a new session row and returns the full persisted record.
 *
 * Optional fields (`issue_number`, `issue_title`) default to `null` when
 * omitted. The `ended_at` column is always `null` on creation.
 */
export async function createSession(db: AppDatabase, input: CreateSessionInput): Promise<Session> {
  const result = await db
    .insertInto('sessions')
    .values({
      project_dir: input.project_dir,
      status: input.status,
      started_at: input.started_at,
      issue_number: input.issue_number ?? null,
      issue_title: input.issue_title ?? null,
      ended_at: null,
      last_activity_at: input.last_activity_at ?? input.started_at,
    } as never)
    .executeTakeFirstOrThrow();

  const id = Number(result.insertId);
  const session = await getSession(db, id);

  if (session === undefined) {
    throw new Error(`Failed to retrieve session after insert (id=${id})`);
  }

  return session;
}

/**
 * Retrieves a single session by primary key.
 *
 * Returns `undefined` when no row matches the given ID.
 */
export async function getSession(db: AppDatabase, id: number): Promise<Session | undefined> {
  return db.selectFrom('sessions').selectAll().where('id', '=', id).executeTakeFirst() as Promise<
    Session | undefined
  >;
}

/**
 * Updates an existing session with the provided fields and returns the full
 * updated record.
 *
 * Only fields present in `input` are written; omitted fields remain unchanged.
 *
 * @throws {Error} If no session exists with the given ID
 */
export async function updateSession(
  db: AppDatabase,
  id: number,
  input: UpdateSessionInput,
): Promise<Session> {
  // Build an object containing only the fields that were actually provided.
  // This avoids overwriting columns the caller did not intend to change.
  const updates: Record<string, unknown> = {};

  if (input.status !== undefined) {
    updates['status'] = input.status;
  }
  if (input.ended_at !== undefined) {
    updates['ended_at'] = input.ended_at;
  }
  if (input.last_activity_at !== undefined) {
    updates['last_activity_at'] = input.last_activity_at;
  }
  if (input.issue_number !== undefined) {
    updates['issue_number'] = input.issue_number;
  }
  if (input.issue_title !== undefined) {
    updates['issue_title'] = input.issue_title;
  }

  // Guard: nothing to update
  if (Object.keys(updates).length === 0) {
    const existing = await getSession(db, id);
    if (existing === undefined) {
      throw new Error(`Session not found (id=${id})`);
    }
    return existing;
  }

  const result = await db
    .updateTable('sessions')
    .set(updates as never)
    .where('id', '=', id)
    .executeTakeFirst();

  // `numUpdatedRows` is 0n when the ID doesn't match any row
  if (result.numUpdatedRows === 0n) {
    throw new Error(`Session not found (id=${id})`);
  }

  const session = await getSession(db, id);

  if (session === undefined) {
    throw new Error(`Failed to retrieve session after update (id=${id})`);
  }

  return session;
}
