import type { AppDatabase } from '../db.js';
import type { KataSpec } from '../../types/domain.js';

// ── Input Types ─────────────────────────────────────────────────────────────

export interface CreateKataInput {
  gap_id: number;
  title: string;
  description: string;
  scaffolding_code: string;
  instructor_notes: string;
  constraints: string;
  created_at: string;
}

// ── Queries ─────────────────────────────────────────────────────────────────

/**
 * Inserts a new kata spec into the `kata_specs` table and returns the full
 * persisted row.
 *
 * The `user_attempts` column defaults to `'[]'` (empty JSON array) via the
 * database schema default.
 */
export async function createKata(db: AppDatabase, input: CreateKataInput): Promise<KataSpec> {
  const result = await db
    .insertInto('kata_specs')
    .values({
      gap_id: input.gap_id,
      title: input.title,
      description: input.description,
      scaffolding_code: input.scaffolding_code,
      instructor_notes: input.instructor_notes,
      constraints: input.constraints,
      created_at: input.created_at,
    } as never)
    .executeTakeFirstOrThrow();

  const id = Number(result.insertId);

  const kata = await db
    .selectFrom('kata_specs')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow();

  return kata as KataSpec;
}

/**
 * Retrieves a single kata spec by its ID. Returns `null` if no kata exists
 * with the given ID.
 */
export async function getKataById(db: AppDatabase, id: number): Promise<KataSpec | null> {
  const result = await db
    .selectFrom('kata_specs')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();

  return (result ?? null) as KataSpec | null;
}

/**
 * Retrieves all kata specs belonging to the given knowledge gap, ordered by
 * `created_at` ascending (chronological order). Returns an empty array if
 * no katas exist for the gap.
 */
export async function getKatasByGap(db: AppDatabase, gapId: number): Promise<KataSpec[]> {
  const katas = await db
    .selectFrom('kata_specs')
    .selectAll()
    .where('gap_id', '=', gapId)
    .orderBy('created_at', 'asc')
    .execute();

  return katas as KataSpec[];
}

/**
 * Updates the `user_attempts` JSON field on a kata spec and returns the full
 * updated row.
 *
 * @throws {Error} If no kata spec exists with the given ID
 */
export async function updateKataAttempts(
  db: AppDatabase,
  id: number,
  userAttempts: string,
): Promise<KataSpec> {
  const result = await db
    .updateTable('kata_specs')
    .set({ user_attempts: userAttempts } as never)
    .where('id', '=', id)
    .executeTakeFirst();

  if (result.numUpdatedRows === 0n) {
    throw new Error(`Kata spec not found (id=${id})`);
  }

  const kata = await db
    .selectFrom('kata_specs')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow();

  return kata as KataSpec;
}
