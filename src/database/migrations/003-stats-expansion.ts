import { type Kysely, sql } from 'kysely';

/**
 * Stats expansion migration: adds tables and columns needed for the
 * dashboard stats bento grid.
 *
 * New tables: hint_level_spans, issue_labels
 * Altered tables: sessions (adds total_duration_ms)
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`PRAGMA foreign_keys = ON`.execute(db);

  // ── hint_level_spans ──────────────────────────────────────────────────────
  // Tracks time spent at each hint level per session
  await db.schema
    .createTable('hint_level_spans')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('session_id', 'integer', (col) => col.notNull().references('sessions.id'))
    .addColumn('level', 'integer', (col) => col.notNull())
    .addColumn('started_at', 'text', (col) => col.notNull())
    .addColumn('ended_at', 'text')
    .execute();

  await db.schema
    .createIndex('idx_hint_level_spans_session')
    .ifNotExists()
    .on('hint_level_spans')
    .column('session_id')
    .execute();

  // ── issue_labels ──────────────────────────────────────────────────────────
  // Caches GitHub issue labels for dashboard display
  await db.schema
    .createTable('issue_labels')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('issue_number', 'integer', (col) => col.notNull())
    .addColumn('label_name', 'text', (col) => col.notNull())
    .addColumn('label_color', 'text')
    .execute();

  await db.schema
    .createIndex('idx_issue_labels_issue')
    .ifNotExists()
    .on('issue_labels')
    .column('issue_number')
    .execute();

  // ── sessions.total_duration_ms ────────────────────────────────────────────
  // Pre-computed total session duration for fast dashboard queries
  await db.schema.alterTable('sessions').addColumn('total_duration_ms', 'integer').execute();
}

/**
 * Rolls back the stats expansion migration.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('issue_labels').ifExists().execute();
  await db.schema.dropTable('hint_level_spans').ifExists().execute();
  // Note: SQLite doesn't support DROP COLUMN natively, but the
  // total_duration_ms column is nullable so leaving it is safe on rollback.
}
