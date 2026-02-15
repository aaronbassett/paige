import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('learning_materials')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('session_id', 'integer', (col) => col.notNull().references('sessions.id'))
    .addColumn('phase_id', 'integer', (col) => col.references('phases.id'))
    .addColumn('type', 'text', (col) => col.notNull().check(sql`type IN ('youtube', 'article')`))
    .addColumn('url', 'text', (col) => col.notNull())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('thumbnail_url', 'text')
    .addColumn('question', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) =>
      col
        .notNull()
        .defaultTo('pending')
        .check(sql`status IN ('pending', 'completed', 'dismissed')`),
    )
    .addColumn('view_count', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'text', (col) => col.notNull())
    .addColumn('completed_at', 'text')
    .execute();

  await db.schema
    .createIndex('idx_learning_materials_session_id')
    .ifNotExists()
    .on('learning_materials')
    .column('session_id')
    .execute();

  await db.schema
    .createIndex('idx_learning_materials_status')
    .ifNotExists()
    .on('learning_materials')
    .column('status')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_learning_materials_status').ifExists().execute();
  await db.schema.dropIndex('idx_learning_materials_session_id').ifExists().execute();
  await db.schema.dropTable('learning_materials').ifExists().execute();
}
