import type { AppDatabase } from '../db.js';
import type { KnowledgeGap, GapSeverity } from '../../types/domain.js';

// ── Input Types ─────────────────────────────────────────────────────────────

export interface CreateGapInput {
  session_id: number;
  topic: string;
  severity: GapSeverity;
  evidence: string;
  related_concepts: string;
  identified_at: string;
}

// ── Queries ─────────────────────────────────────────────────────────────────

/**
 * Inserts a new knowledge gap row and returns the full persisted record.
 *
 * The `addressed` column defaults to 0 (unaddressed) via the database schema.
 */
export async function createGap(db: AppDatabase, input: CreateGapInput): Promise<KnowledgeGap> {
  const result = await db
    .insertInto('knowledge_gaps')
    .values({
      session_id: input.session_id,
      topic: input.topic,
      severity: input.severity,
      evidence: input.evidence,
      related_concepts: input.related_concepts,
      identified_at: input.identified_at,
    } as never)
    .executeTakeFirstOrThrow();

  const id = Number(result.insertId);

  const gap = await db
    .selectFrom('knowledge_gaps')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow();

  return gap as KnowledgeGap;
}

/**
 * Retrieves all knowledge gaps for a given session, ordered by identification time.
 *
 * Returns an empty array when no gaps exist for the session.
 */
export async function getGapsBySession(
  db: AppDatabase,
  sessionId: number,
): Promise<KnowledgeGap[]> {
  const gaps = await db
    .selectFrom('knowledge_gaps')
    .selectAll()
    .where('session_id', '=', sessionId)
    .orderBy('identified_at', 'asc')
    .execute();

  return gaps as KnowledgeGap[];
}

/**
 * Marks a knowledge gap as addressed by setting `addressed` to 1.
 *
 * Returns the full updated record.
 *
 * @throws {Error} If no gap exists with the given ID
 */
export async function markGapAddressed(db: AppDatabase, id: number): Promise<KnowledgeGap> {
  const result = await db
    .updateTable('knowledge_gaps')
    .set({ addressed: 1 } as never)
    .where('id', '=', id)
    .executeTakeFirst();

  if (result.numUpdatedRows === 0n) {
    throw new Error(`Knowledge gap not found (id=${id})`);
  }

  const gap = await db
    .selectFrom('knowledge_gaps')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow();

  return gap as KnowledgeGap;
}
