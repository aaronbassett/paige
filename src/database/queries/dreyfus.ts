import type { AppDatabase } from '../db.js';
import type { DreyfusAssessment, DreyfusStage } from '../../types/domain.js';

// ── Input Types ─────────────────────────────────────────────────────────────

export interface UpsertDreyfusInput {
  skill_area: string;
  stage: DreyfusStage;
  confidence: number;
  evidence: string;
  assessed_at: string;
}

// ── Queries ─────────────────────────────────────────────────────────────────

/**
 * Inserts a new Dreyfus assessment or updates an existing one by `skill_area`.
 *
 * Uses SQLite's ON CONFLICT clause to perform an upsert. When a row with the
 * given `skill_area` already exists, the `stage`, `confidence`, `evidence`,
 * and `assessed_at` columns are overwritten with the new values.
 *
 * @returns The full persisted row after the upsert
 */
export async function upsertDreyfus(
  db: AppDatabase,
  input: UpsertDreyfusInput,
): Promise<DreyfusAssessment> {
  await db
    .insertInto('dreyfus_assessments')
    .values({
      skill_area: input.skill_area,
      stage: input.stage,
      confidence: input.confidence,
      evidence: input.evidence,
      assessed_at: input.assessed_at,
    } as never)
    .onConflict((oc) =>
      oc.column('skill_area').doUpdateSet({
        stage: input.stage,
        confidence: input.confidence,
        evidence: input.evidence,
        assessed_at: input.assessed_at,
      } as never),
    )
    .executeTakeFirstOrThrow();

  // Re-query by skill_area to return the full row (including the id)
  const row = await getDreyfusBySkill(db, input.skill_area);

  if (row === undefined) {
    throw new Error(
      `Failed to retrieve dreyfus assessment after upsert (skill_area="${input.skill_area}")`,
    );
  }

  return row;
}

/**
 * Retrieves a single Dreyfus assessment by skill area.
 *
 * Returns `undefined` when no row matches the given skill area.
 */
export async function getDreyfusBySkill(
  db: AppDatabase,
  skillArea: string,
): Promise<DreyfusAssessment | undefined> {
  return db
    .selectFrom('dreyfus_assessments')
    .selectAll()
    .where('skill_area', '=', skillArea)
    .executeTakeFirst() as Promise<DreyfusAssessment | undefined>;
}

/**
 * Retrieves all Dreyfus assessments ordered alphabetically by skill area.
 */
export async function getAllDreyfus(db: AppDatabase): Promise<DreyfusAssessment[]> {
  return db
    .selectFrom('dreyfus_assessments')
    .selectAll()
    .orderBy('skill_area', 'asc')
    .execute() as Promise<DreyfusAssessment[]>;
}
