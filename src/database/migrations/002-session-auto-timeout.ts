import { type Kysely, sql } from 'kysely';

/**
 * Migration 002: Add last_activity_at column to sessions table.
 *
 * Supports server-managed session auto-timeout (15-minute inactivity window).
 * Backfills existing rows with their started_at value.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // Add last_activity_at column
  await db.schema.alterTable('sessions').addColumn('last_activity_at', 'text').execute();

  // Backfill existing rows: set last_activity_at = started_at
  await sql`UPDATE sessions SET last_activity_at = started_at WHERE last_activity_at IS NULL`.execute(
    db,
  );

  // Add composite index for the resolve query (status + last_activity_at)
  await db.schema
    .createIndex('idx_sessions_status_last_activity')
    .ifNotExists()
    .on('sessions')
    .columns(['status', 'last_activity_at'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_sessions_status_last_activity').ifExists().execute();

  // SQLite doesn't support DROP COLUMN directly in older versions,
  // but Kysely handles it via table recreation if needed.
  await db.schema.alterTable('sessions').dropColumn('last_activity_at').execute();
}
