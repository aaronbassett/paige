import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect, Migrator, type Migration, type MigrationProvider } from 'kysely';
import type { DatabaseTables } from '../../../../src/types/domain.js';
import {
  createSession,
  getInProgressIssueNumbers,
} from '../../../../src/database/queries/sessions.js';

import * as migration001 from '../../../../src/database/migrations/001-initial.js';
import * as migration002 from '../../../../src/database/migrations/002-session-auto-timeout.js';
import * as migration003 from '../../../../src/database/migrations/003-stats-expansion.js';

/**
 * Unit tests for getInProgressIssueNumbers query.
 *
 * Uses an in-memory SQLite database with the same migration stack as production
 * to verify the query correctly filters active sessions with non-null issue numbers.
 */

class InlineMigrationProvider implements MigrationProvider {
  getMigrations(): Promise<Record<string, Migration>> {
    return Promise.resolve({
      '001-initial': migration001,
      '002-session-auto-timeout': migration002,
      '003-stats-expansion': migration003,
    });
  }
}

describe('getInProgressIssueNumbers', () => {
  let db: Kysely<DatabaseTables>;

  beforeAll(async () => {
    const sqliteDb = new Database(':memory:');
    sqliteDb.pragma('foreign_keys = ON');

    db = new Kysely<DatabaseTables>({
      dialect: new SqliteDialect({ database: sqliteDb }),
    });

    const migrator = new Migrator({
      db,
      provider: new InlineMigrationProvider(),
    });

    const { error } = await migrator.migrateToLatest();
    if (error instanceof Error) {
      throw error;
    }
    if (error !== undefined) {
      throw new Error('Migration failed with an unknown error');
    }
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('returns empty array when no active sessions', async () => {
    const result = await getInProgressIssueNumbers(db);
    expect(result).toEqual([]);
  });

  it('returns issue numbers from active sessions', async () => {
    await createSession(db, {
      project_dir: '/tmp/project-a',
      status: 'active',
      started_at: new Date().toISOString(),
      issue_number: 42,
      issue_title: 'Fix login bug',
    });

    await createSession(db, {
      project_dir: '/tmp/project-b',
      status: 'active',
      started_at: new Date().toISOString(),
      issue_number: 99,
      issue_title: 'Add dark mode',
    });

    const result = await getInProgressIssueNumbers(db);
    expect(result).toEqual(expect.arrayContaining([42, 99]));
    expect(result).toHaveLength(2);
  });

  it('excludes completed sessions', async () => {
    await createSession(db, {
      project_dir: '/tmp/project-c',
      status: 'completed',
      started_at: new Date().toISOString(),
      issue_number: 7,
      issue_title: 'Completed issue',
    });

    const result = await getInProgressIssueNumbers(db);
    // Should still only have 42 and 99 from the previous test
    expect(result).not.toContain(7);
  });

  it('excludes sessions without issue numbers', async () => {
    await createSession(db, {
      project_dir: '/tmp/project-d',
      status: 'active',
      started_at: new Date().toISOString(),
      // No issue_number — should be excluded
    });

    const result = await getInProgressIssueNumbers(db);
    // Should still only have 42 and 99 from previous tests
    expect(result).toEqual(expect.arrayContaining([42, 99]));
    expect(result).toHaveLength(2);
  });
});
