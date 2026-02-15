import { type Kysely } from 'kysely';

/**
 * Migration 004: Add branch_name and stash_name columns to sessions table.
 *
 * Supports the review-commit-PR workflow where Paige creates a working branch
 * and stashes uncommitted changes before starting a review session.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('sessions').addColumn('branch_name', 'text').execute();

  await db.schema.alterTable('sessions').addColumn('stash_name', 'text').execute();
}
