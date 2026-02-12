import { type Kysely, sql } from 'kysely';

/**
 * Initial migration: creates all 11 application tables and 15 indexes.
 *
 * Tables: sessions, plans, phases, phase_hints, progress_events,
 * dreyfus_assessments, knowledge_gaps, kata_specs, action_log,
 * api_call_log, session_wrap_up_errors.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // Enable foreign key enforcement (must be set per-connection in SQLite)
  await sql`PRAGMA foreign_keys = ON`.execute(db);

  // ── sessions ──────────────────────────────────────────────────────────────
  await db.schema
    .createTable('sessions')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('project_dir', 'text', (col) => col.notNull())
    .addColumn('issue_number', 'integer')
    .addColumn('issue_title', 'text')
    .addColumn('status', 'text', (col) =>
      col.notNull().check(sql`status IN ('active', 'completed')`),
    )
    .addColumn('started_at', 'text', (col) => col.notNull())
    .addColumn('ended_at', 'text')
    .execute();

  // ── plans ─────────────────────────────────────────────────────────────────
  await db.schema
    .createTable('plans')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('session_id', 'integer', (col) => col.notNull().references('sessions.id'))
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('total_phases', 'integer', (col) => col.notNull())
    .addColumn('created_at', 'text', (col) => col.notNull())
    .addColumn('is_active', 'integer', (col) => col.notNull().defaultTo(1))
    .execute();

  // ── phases ────────────────────────────────────────────────────────────────
  await db.schema
    .createTable('phases')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('plan_id', 'integer', (col) => col.notNull().references('plans.id'))
    .addColumn('number', 'integer', (col) => col.notNull())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('hint_level', 'text', (col) =>
      col.notNull().check(sql`hint_level IN ('off', 'low', 'medium', 'high')`),
    )
    .addColumn('status', 'text', (col) =>
      col.notNull().check(sql`status IN ('pending', 'active', 'complete')`),
    )
    .addColumn('started_at', 'text')
    .addColumn('completed_at', 'text')
    .addUniqueConstraint('uq_phases_plan_number', ['plan_id', 'number'])
    .execute();

  // ── phase_hints ───────────────────────────────────────────────────────────
  await db.schema
    .createTable('phase_hints')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('phase_id', 'integer', (col) => col.notNull().references('phases.id'))
    .addColumn('type', 'text', (col) => col.notNull().check(sql`type IN ('file', 'line')`))
    .addColumn('path', 'text', (col) => col.notNull())
    .addColumn('line_start', 'integer')
    .addColumn('line_end', 'integer')
    .addColumn('style', 'text', (col) =>
      col.notNull().check(sql`style IN ('suggested', 'warning', 'error')`),
    )
    .addColumn('hover_text', 'text')
    .addColumn('required_level', 'text', (col) =>
      col.notNull().check(sql`required_level IN ('low', 'medium', 'high')`),
    )
    .execute();

  // ── progress_events ───────────────────────────────────────────────────────
  await db.schema
    .createTable('progress_events')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('phase_id', 'integer', (col) => col.notNull().references('phases.id'))
    .addColumn('event_type', 'text', (col) => col.notNull())
    .addColumn('data', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull())
    .execute();

  // ── dreyfus_assessments ───────────────────────────────────────────────────
  await db.schema
    .createTable('dreyfus_assessments')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('skill_area', 'text', (col) => col.notNull().unique())
    .addColumn('stage', 'text', (col) =>
      col
        .notNull()
        .check(sql`stage IN ('Novice', 'Advanced Beginner', 'Competent', 'Proficient', 'Expert')`),
    )
    .addColumn('confidence', 'real', (col) =>
      col.notNull().check(sql`confidence >= 0.0 AND confidence <= 1.0`),
    )
    .addColumn('evidence', 'text', (col) => col.notNull())
    .addColumn('assessed_at', 'text', (col) => col.notNull())
    .execute();

  // ── knowledge_gaps ────────────────────────────────────────────────────────
  await db.schema
    .createTable('knowledge_gaps')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('session_id', 'integer', (col) => col.notNull().references('sessions.id'))
    .addColumn('topic', 'text', (col) => col.notNull())
    .addColumn('severity', 'text', (col) =>
      col.notNull().check(sql`severity IN ('low', 'medium', 'high')`),
    )
    .addColumn('evidence', 'text', (col) => col.notNull())
    .addColumn('related_concepts', 'text', (col) => col.notNull())
    .addColumn('addressed', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('identified_at', 'text', (col) => col.notNull())
    .execute();

  // ── kata_specs ────────────────────────────────────────────────────────────
  await db.schema
    .createTable('kata_specs')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('gap_id', 'integer', (col) => col.notNull().references('knowledge_gaps.id'))
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('scaffolding_code', 'text', (col) => col.notNull())
    .addColumn('instructor_notes', 'text', (col) => col.notNull())
    .addColumn('constraints', 'text', (col) => col.notNull())
    .addColumn('user_attempts', 'text', (col) => col.notNull().defaultTo('[]'))
    .addColumn('created_at', 'text', (col) => col.notNull())
    .execute();

  // ── action_log ────────────────────────────────────────────────────────────
  await db.schema
    .createTable('action_log')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('session_id', 'integer', (col) => col.notNull().references('sessions.id'))
    .addColumn('action_type', 'text', (col) => col.notNull())
    .addColumn('data', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull())
    .execute();

  // ── api_call_log ──────────────────────────────────────────────────────────
  await db.schema
    .createTable('api_call_log')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('session_id', 'integer', (col) => col.notNull().references('sessions.id'))
    .addColumn('call_type', 'text', (col) => col.notNull())
    .addColumn('model', 'text', (col) => col.notNull())
    .addColumn('input_hash', 'text')
    .addColumn('latency_ms', 'integer', (col) => col.notNull())
    .addColumn('input_tokens', 'integer', (col) => col.notNull())
    .addColumn('output_tokens', 'integer', (col) => col.notNull())
    .addColumn('cost_estimate', 'real', (col) => col.notNull())
    .addColumn('created_at', 'text', (col) => col.notNull())
    .execute();

  // ── session_wrap_up_errors ────────────────────────────────────────────────
  await db.schema
    .createTable('session_wrap_up_errors')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('session_id', 'integer', (col) => col.notNull().references('sessions.id'))
    .addColumn('agent_name', 'text', (col) =>
      col.notNull().check(sql`agent_name IN ('reflection', 'knowledge_gap', 'dreyfus')`),
    )
    .addColumn('error_message', 'text', (col) => col.notNull())
    .addColumn('created_at', 'text', (col) => col.notNull())
    .execute();

  // ── Indexes ───────────────────────────────────────────────────────────────
  await db.schema
    .createIndex('idx_sessions_status')
    .ifNotExists()
    .on('sessions')
    .column('status')
    .execute();

  await db.schema
    .createIndex('idx_plans_session_id')
    .ifNotExists()
    .on('plans')
    .column('session_id')
    .execute();

  await db.schema
    .createIndex('idx_plans_is_active')
    .ifNotExists()
    .on('plans')
    .column('is_active')
    .execute();

  await db.schema
    .createIndex('idx_phases_plan_id')
    .ifNotExists()
    .on('phases')
    .column('plan_id')
    .execute();

  await db.schema
    .createIndex('idx_phases_status')
    .ifNotExists()
    .on('phases')
    .column('status')
    .execute();

  await db.schema
    .createIndex('idx_phase_hints_phase_id')
    .ifNotExists()
    .on('phase_hints')
    .column('phase_id')
    .execute();

  await db.schema
    .createIndex('idx_progress_events_phase_id')
    .ifNotExists()
    .on('progress_events')
    .column('phase_id')
    .execute();

  await db.schema
    .createIndex('idx_knowledge_gaps_session_id')
    .ifNotExists()
    .on('knowledge_gaps')
    .column('session_id')
    .execute();

  await db.schema
    .createIndex('idx_knowledge_gaps_addressed')
    .ifNotExists()
    .on('knowledge_gaps')
    .column('addressed')
    .execute();

  await db.schema
    .createIndex('idx_kata_specs_gap_id')
    .ifNotExists()
    .on('kata_specs')
    .column('gap_id')
    .execute();

  await db.schema
    .createIndex('idx_action_log_session_id')
    .ifNotExists()
    .on('action_log')
    .column('session_id')
    .execute();

  await db.schema
    .createIndex('idx_action_log_created_at')
    .ifNotExists()
    .on('action_log')
    .column('created_at')
    .execute();

  await db.schema
    .createIndex('idx_action_log_type')
    .ifNotExists()
    .on('action_log')
    .column('action_type')
    .execute();

  await db.schema
    .createIndex('idx_api_call_log_session_id')
    .ifNotExists()
    .on('api_call_log')
    .column('session_id')
    .execute();

  await db.schema
    .createIndex('idx_wrap_up_errors_session_id')
    .ifNotExists()
    .on('session_wrap_up_errors')
    .column('session_id')
    .execute();
}

/**
 * Rolls back the initial migration by dropping all tables in reverse
 * dependency order.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  // Drop in reverse dependency order to respect foreign keys
  const tables = [
    'session_wrap_up_errors',
    'api_call_log',
    'action_log',
    'kata_specs',
    'knowledge_gaps',
    'dreyfus_assessments',
    'progress_events',
    'phase_hints',
    'phases',
    'plans',
    'sessions',
  ] as const;

  for (const table of tables) {
    await db.schema.dropTable(table).ifExists().execute();
  }
}
