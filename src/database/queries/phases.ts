import type { AppDatabase } from '../db.js';
import type { Phase, HintLevel, PhaseStatus } from '../../types/domain.js';

export interface CreatePhaseInput {
  plan_id: number;
  number: number;
  title: string;
  description: string;
  hint_level: HintLevel;
  status: PhaseStatus;
}

/**
 * Inserts a new phase into the `phases` table and returns the full row.
 *
 * `started_at` and `completed_at` default to null (phase has not begun).
 */
export async function createPhase(db: AppDatabase, input: CreatePhaseInput): Promise<Phase> {
  const result = await db
    .insertInto('phases')
    .values({
      plan_id: input.plan_id,
      number: input.number,
      title: input.title,
      description: input.description,
      hint_level: input.hint_level,
      status: input.status,
      started_at: null,
      completed_at: null,
    } as never)
    .executeTakeFirstOrThrow();

  const id = Number(result.insertId);

  const phase = await db
    .selectFrom('phases')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow();

  return phase;
}

/**
 * Returns all phases belonging to the given plan, ordered by phase number
 * ascending (sequential execution order). Returns an empty array if no
 * phases exist for the plan.
 */
export async function getPhasesByPlan(db: AppDatabase, planId: number): Promise<Phase[]> {
  return db
    .selectFrom('phases')
    .selectAll()
    .where('plan_id', '=', planId)
    .orderBy('number', 'asc')
    .execute();
}
