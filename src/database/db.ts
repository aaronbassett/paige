import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { Kysely, Migrator, SqliteDialect, type Migration, type MigrationProvider } from 'kysely';
import type { DatabaseTables } from '../types/domain.js';
import * as migration001 from './migrations/001-initial.js';

// ── Types ───────────────────────────────────────────────────────────────────

/** The typed Kysely database instance used throughout the application. */
export type AppDatabase = Kysely<DatabaseTables>;

// ── Module State ────────────────────────────────────────────────────────────

let db: AppDatabase | null = null;
let sqliteDb: Database.Database | null = null;

// ── Migration Provider ──────────────────────────────────────────────────────

/**
 * Inline migration provider that returns all migrations from imported modules.
 * This avoids dynamic file-system scanning and works reliably with ESM bundling.
 */
class InlineMigrationProvider implements MigrationProvider {
  getMigrations(): Promise<Record<string, Migration>> {
    return Promise.resolve({
      '001-initial': migration001,
    });
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Creates and configures the SQLite database with Kysely.
 *
 * - Creates the database directory if it does not exist
 * - Opens better-sqlite3 with WAL journal mode for concurrent reads
 * - Enables foreign key enforcement
 * - Runs all pending migrations
 *
 * @param dbPath - Absolute path to the SQLite database file
 * @returns The typed Kysely database instance
 * @throws {Error} If migrations fail
 */
export async function createDatabase(dbPath: string): Promise<AppDatabase> {
  if (db !== null) {
    return db;
  }

  // Ensure the parent directory exists
  mkdirSync(dirname(dbPath), { recursive: true });

  // Initialize better-sqlite3 with WAL mode for performance
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');

  // Create the Kysely instance
  db = new Kysely<DatabaseTables>({
    dialect: new SqliteDialect({
      database: sqliteDb,
    }),
  });

  // Run all pending migrations
  await runMigrations(db);

  return db;
}

/**
 * Returns the current database instance, or null if not yet created.
 * Use this for dependency injection in modules that need DB access.
 */
export function getDatabase(): AppDatabase | null {
  return db;
}

/**
 * Gracefully closes the database connection.
 * Safe to call multiple times; subsequent calls are no-ops.
 */
export async function closeDatabase(): Promise<void> {
  if (db !== null) {
    await db.destroy();
    db = null;
    sqliteDb = null;
  }
}

// ── Internal ────────────────────────────────────────────────────────────────

/**
 * Runs all pending migrations and throws if any migration fails.
 */
async function runMigrations(database: AppDatabase): Promise<void> {
  const migrator = new Migrator({
    db: database,
    provider: new InlineMigrationProvider(),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((result) => {
    if (result.status === 'Success') {
      // eslint-disable-next-line no-console
      console.log(`[db] Migration "${result.migrationName}" applied successfully`);
    } else if (result.status === 'Error') {
      // eslint-disable-next-line no-console
      console.error(`[db] Migration "${result.migrationName}" failed`);
    }
  });

  if (error !== undefined) {
    const message = error instanceof Error ? error.message : 'Unknown migration error';
    throw new Error(`Database migration failed: ${message}`);
  }
}
