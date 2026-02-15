import type { Kysely } from 'kysely';
import type {
  DatabaseTables,
  LearningMaterial,
  LearningMaterialStatus,
} from '../../types/domain.js';

export interface CreateLearningMaterialInput {
  session_id: number;
  phase_id: number | null;
  type: 'youtube' | 'article';
  url: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  question: string;
}

export async function createLearningMaterial(
  db: Kysely<DatabaseTables>,
  input: CreateLearningMaterialInput,
): Promise<LearningMaterial> {
  const created_at = new Date().toISOString();

  const result = await db
    .insertInto('learning_materials')
    .values({
      ...input,
      status: 'pending',
      view_count: 0,
      created_at,
      completed_at: null,
    } as never)
    .executeTakeFirstOrThrow();

  const id = Number(result.insertId);
  return db
    .selectFrom('learning_materials')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow();
}

export async function getLearningMaterial(
  db: Kysely<DatabaseTables>,
  id: number,
): Promise<LearningMaterial | undefined> {
  return db.selectFrom('learning_materials').selectAll().where('id', '=', id).executeTakeFirst();
}

export async function getLearningMaterialsBySession(
  db: Kysely<DatabaseTables>,
  sessionId: number,
  statusFilter: LearningMaterialStatus = 'pending',
): Promise<LearningMaterial[]> {
  return db
    .selectFrom('learning_materials')
    .selectAll()
    .where('session_id', '=', sessionId)
    .where('status', '=', statusFilter)
    .orderBy('created_at', 'desc')
    .execute();
}

export async function updateLearningMaterialStatus(
  db: Kysely<DatabaseTables>,
  id: number,
  status: LearningMaterialStatus,
): Promise<LearningMaterial | undefined> {
  const updates: Record<string, unknown> = { status };
  if (status === 'completed') {
    updates['completed_at'] = new Date().toISOString();
  }

  await db
    .updateTable('learning_materials')
    .set(updates as never)
    .where('id', '=', id)
    .execute();

  return getLearningMaterial(db, id);
}

export async function incrementViewCount(
  db: Kysely<DatabaseTables>,
  id: number,
): Promise<LearningMaterial | undefined> {
  const material = await getLearningMaterial(db, id);
  if (!material) return undefined;

  await db
    .updateTable('learning_materials')
    .set({ view_count: material.view_count + 1 } as never)
    .where('id', '=', id)
    .execute();

  return getLearningMaterial(db, id);
}
