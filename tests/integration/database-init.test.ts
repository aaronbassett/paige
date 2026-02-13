import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'kysely';
import { createDatabase, closeDatabase, getDatabase } from '../../src/database/db.js';

/**
 * Integration tests for database initialization (User Story 2: SQLite State Management).
 *
 * These tests verify that `createDatabase()` correctly creates all 11 tables,
 * 15 indexes, enables WAL mode, and enforces foreign keys. They use a real
 * SQLite database in a temporary directory — no mocking.
 */

/** All 11 application tables created by the initial migration. */
const EXPECTED_TABLES = [
  'sessions',
  'plans',
  'phases',
  'phase_hints',
  'progress_events',
  'dreyfus_assessments',
  'knowledge_gaps',
  'kata_specs',
  'action_log',
  'api_call_log',
  'session_wrap_up_errors',
] as const;

/** All 16 indexes created by migrations 001 + 002. */
const EXPECTED_INDEXES = [
  'idx_sessions_status',
  'idx_sessions_status_last_activity',
  'idx_plans_session_id',
  'idx_plans_is_active',
  'idx_phases_plan_id',
  'idx_phases_status',
  'idx_phase_hints_phase_id',
  'idx_progress_events_phase_id',
  'idx_knowledge_gaps_session_id',
  'idx_knowledge_gaps_addressed',
  'idx_kata_specs_gap_id',
  'idx_action_log_session_id',
  'idx_action_log_created_at',
  'idx_action_log_type',
  'idx_api_call_log_session_id',
  'idx_wrap_up_errors_session_id',
] as const;

/** Shape returned by querying sqlite_master for tables. */
interface SqliteMasterRow {
  type: string;
  name: string;
  tbl_name: string;
}

/** Shape returned by PRAGMA journal_mode. */
interface JournalModeRow {
  journal_mode: string;
}

/** Shape returned by PRAGMA foreign_keys. */
interface ForeignKeysRow {
  foreign_keys: number;
}

describe('Database initialization', () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'paige-db-init-'));
    dbPath = join(tempDir, 'test.db');
  });

  afterEach(async () => {
    // Always close the singleton so the next test starts fresh
    await closeDatabase();

    // Clean up temp directory
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates all 11 tables on a fresh database', async () => {
    const db = await createDatabase(dbPath);

    const rows = await sql<SqliteMasterRow>`
      SELECT type, name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'kysely_%'
      ORDER BY name
    `.execute(db);

    const tableNames = rows.rows.map((row) => row.name).sort();
    const expectedSorted = [...EXPECTED_TABLES].sort();

    expect(tableNames).toEqual(expectedSorted);
    expect(tableNames).toHaveLength(11);
  });

  it('enables WAL journal mode', async () => {
    const db = await createDatabase(dbPath);

    const result = await sql<JournalModeRow>`PRAGMA journal_mode`.execute(db);

    expect(result.rows[0]?.journal_mode).toBe('wal');
  });

  it('enables foreign key enforcement', async () => {
    const db = await createDatabase(dbPath);

    const result = await sql<ForeignKeysRow>`PRAGMA foreign_keys`.execute(db);

    expect(result.rows[0]?.foreign_keys).toBe(1);
  });

  it('creates all 16 indexes', async () => {
    const db = await createDatabase(dbPath);

    const rows = await sql<SqliteMasterRow>`
      SELECT type, name FROM sqlite_master
      WHERE type = 'index' AND name LIKE 'idx_%'
      ORDER BY name
    `.execute(db);

    const indexNames = rows.rows.map((row) => row.name).sort();
    const expectedSorted = [...EXPECTED_INDEXES].sort();

    expect(indexNames).toEqual(expectedSorted);
    expect(indexNames).toHaveLength(16);
  });

  it('returns the same instance on idempotent creation', async () => {
    const first = await createDatabase(dbPath);
    const second = await createDatabase(dbPath);

    expect(second).toBe(first);
  });

  it('returns null from getDatabase() after closeDatabase()', async () => {
    await createDatabase(dbPath);

    // Sanity check: getDatabase() returns the instance before close
    expect(getDatabase()).not.toBeNull();

    await closeDatabase();

    expect(getDatabase()).toBeNull();
  });
});
