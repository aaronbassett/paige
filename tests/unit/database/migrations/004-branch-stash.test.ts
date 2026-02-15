import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { type Generated, Kysely, SqliteDialect } from 'kysely';
import { up as up001 } from '../../../../src/database/migrations/001-initial.js';
import { up as up002 } from '../../../../src/database/migrations/002-session-auto-timeout.js';
import { up as up003 } from '../../../../src/database/migrations/003-stats-expansion.js';
import { up as up004 } from '../../../../src/database/migrations/004-branch-stash.js';

/** Minimal table shape for migration test queries. */
interface TestSessionsTable {
  sessions: {
    id: Generated<number>;
    project_dir: string;
    status: string;
    started_at: string;
    branch_name: string | null;
    stash_name: string | null;
  };
}

describe('004-branch-stash migration', () => {
  let rawDb: Kysely<unknown>;
  let db: Kysely<TestSessionsTable>;

  beforeEach(async () => {
    const sqlite = new Database(':memory:');
    const dialect = new SqliteDialect({ database: sqlite });
    rawDb = new Kysely<unknown>({ dialect });
    db = new Kysely<TestSessionsTable>({ dialect });
    await up001(rawDb);
    await up002(rawDb);
    await up003(rawDb);
  });

  it('adds branch_name and stash_name columns to sessions', async () => {
    await up004(rawDb);
    await db
      .insertInto('sessions')
      .values({
        project_dir: '/test',
        status: 'active',
        started_at: new Date().toISOString(),
        branch_name: 'user/fix-bug',
        stash_name: 'paige-42-1739577600',
      })
      .execute();

    const rows = await db.selectFrom('sessions').selectAll().execute();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveProperty('branch_name', 'user/fix-bug');
    expect(rows[0]).toHaveProperty('stash_name', 'paige-42-1739577600');
  });

  it('allows null branch_name and stash_name', async () => {
    await up004(rawDb);
    await db
      .insertInto('sessions')
      .values({
        project_dir: '/test',
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .execute();

    const rows = await db.selectFrom('sessions').selectAll().execute();
    expect(rows[0]).toHaveProperty('branch_name', null);
    expect(rows[0]).toHaveProperty('stash_name', null);
  });
});
