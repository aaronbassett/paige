import type { AppDatabase } from '../db.js';
import type { Plan } from '../../types/domain.js';

export interface CreatePlanInput {
  session_id: number;
  title: string;
  description: string;
  total_phases: number;
  created_at: string;
}

/**
 * Inserts a new plan into the database and returns the full row.
 *
 * The `is_active` column defaults to 1 (active) via the database schema default.
 */
export async function createPlan(db: AppDatabase, input: CreatePlanInput): Promise<Plan> {
  const result = await db
    .insertInto('plans')
    .values({
      session_id: input.session_id,
      title: input.title,
      description: input.description,
      total_phases: input.total_phases,
      created_at: input.created_at,
    } as never)
    .executeTakeFirstOrThrow();

  const id = Number(result.insertId);

  const plan = await db
    .selectFrom('plans')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow();

  return plan;
}

/**
 * Retrieves all plans for a given session, ordered by creation time (oldest first).
 *
 * Returns an empty array if no plans exist for the session.
 */
export async function getPlansBySession(db: AppDatabase, sessionId: number): Promise<Plan[]> {
  return db
    .selectFrom('plans')
    .selectAll()
    .where('session_id', '=', sessionId)
    .orderBy('created_at', 'asc')
    .execute();
}
