import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase, closeDatabase, type AppDatabase } from '../../src/database/db.js';

// These query modules will be created in T085-T094 (TDD stubs)
import { createSession, getSession, updateSession } from '../../src/database/queries/sessions.js';
import { createPlan, getPlansBySession } from '../../src/database/queries/plans.js';
import { createPhase, getPhasesByPlan } from '../../src/database/queries/phases.js';
import { createHint, getHintsByPhase } from '../../src/database/queries/hints.js';
import {
  createProgressEvent,
  getProgressEventsByPhase,
} from '../../src/database/queries/progress.js';

import type { Session, Plan, Phase, PhaseHint } from '../../src/types/domain.js';

/**
 * Integration tests for a full session lifecycle (User Story 2: SQLite State Management).
 *
 * Exercises the complete round-trip: create session -> create plan -> create phases
 * -> add hints -> add progress events -> query relationships -> complete session.
 *
 * Written TDD-style: these tests MUST fail until the query modules are implemented.
 * The database module itself is already tested in database-init.test.ts.
 */

describe('Session lifecycle (integration)', () => {
  let tempDir: string;
  let dbPath: string;
  let db: AppDatabase;

  // Shared state built up across ordered tests
  let session: Session;
  let plan: Plan;
  let phases: Phase[];
  let fileHint: PhaseHint;
  let lineHint: PhaseHint;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'paige-lifecycle-'));
    dbPath = join(tempDir, 'lifecycle-test.db');
    db = await createDatabase(dbPath);
  });

  afterAll(async () => {
    await closeDatabase();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ── Step 1: Create a session ──────────────────────────────────────────────

  it('creates a session with auto-incremented ID', async () => {
    const now = new Date().toISOString();

    session = await createSession(db, {
      project_dir: '/tmp/test-project',
      status: 'active',
      started_at: now,
    });

    expect(session.id).toBeTypeOf('number');
    expect(session.id).toBeGreaterThan(0);
    expect(session.project_dir).toBe('/tmp/test-project');
    expect(session.status).toBe('active');
    expect(session.started_at).toBe(now);
    expect(session.ended_at).toBeNull();
    expect(session.issue_number).toBeNull();
    expect(session.issue_title).toBeNull();
  });

  it('retrieves the created session by ID', async () => {
    const fetched = await getSession(db, session.id);

    expect(fetched).toBeDefined();
    expect(fetched!.id).toBe(session.id);
    expect(fetched!.project_dir).toBe('/tmp/test-project');
    expect(fetched!.status).toBe('active');
  });

  // ── Step 2: Create a plan for the session ─────────────────────────────────

  it('creates a plan linked to the session', async () => {
    const now = new Date().toISOString();

    plan = await createPlan(db, {
      session_id: session.id,
      title: 'Implement user authentication',
      description: 'Add login, registration, and session management',
      total_phases: 3,
      created_at: now,
    });

    expect(plan.id).toBeTypeOf('number');
    expect(plan.id).toBeGreaterThan(0);
    expect(plan.session_id).toBe(session.id);
    expect(plan.title).toBe('Implement user authentication');
    expect(plan.description).toBe('Add login, registration, and session management');
    expect(plan.total_phases).toBe(3);
    expect(plan.created_at).toBe(now);
    expect(plan.is_active).toBe(1);
  });

  it('retrieves plans by session ID', async () => {
    const plans = await getPlansBySession(db, session.id);

    expect(plans).toHaveLength(1);
    expect(plans[0]!.id).toBe(plan.id);
    expect(plans[0]!.title).toBe('Implement user authentication');
  });

  // ── Step 3: Create phases for the plan ────────────────────────────────────

  it('creates 3 sequential phases for the plan', async () => {
    const phaseData = [
      {
        plan_id: plan.id,
        number: 1,
        title: 'Set up database schema',
        description: 'Create users table with password hash column',
        hint_level: 'off' as const,
        status: 'active' as const,
      },
      {
        plan_id: plan.id,
        number: 2,
        title: 'Implement registration endpoint',
        description: 'POST /register with email + password validation',
        hint_level: 'off' as const,
        status: 'pending' as const,
      },
      {
        plan_id: plan.id,
        number: 3,
        title: 'Implement login endpoint',
        description: 'POST /login with JWT token generation',
        hint_level: 'off' as const,
        status: 'pending' as const,
      },
    ];

    phases = [];
    for (const data of phaseData) {
      const phase = await createPhase(db, data);
      phases.push(phase);
    }

    expect(phases).toHaveLength(3);

    // Verify each phase got a unique auto-incremented ID
    const ids = phases.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);

    // Verify sequential numbers
    expect(phases[0]!.number).toBe(1);
    expect(phases[1]!.number).toBe(2);
    expect(phases[2]!.number).toBe(3);

    // Verify FK relationship
    for (const phase of phases) {
      expect(phase.plan_id).toBe(plan.id);
    }
  });

  it('retrieves phases by plan ID in order', async () => {
    const fetched = await getPhasesByPlan(db, plan.id);

    expect(fetched).toHaveLength(3);
    expect(fetched[0]!.title).toBe('Set up database schema');
    expect(fetched[1]!.title).toBe('Implement registration endpoint');
    expect(fetched[2]!.title).toBe('Implement login endpoint');
  });

  it('enforces unique (plan_id, number) constraint', async () => {
    // Attempt to insert a duplicate phase number for the same plan
    await expect(
      createPhase(db, {
        plan_id: plan.id,
        number: 1, // Duplicate — phase 1 already exists
        title: 'Duplicate phase',
        description: 'Should fail',
        hint_level: 'off',
        status: 'pending',
      }),
    ).rejects.toThrow();
  });

  // ── Step 4: Add hints to a phase ──────────────────────────────────────────

  it('creates a file hint for phase 1', async () => {
    fileHint = await createHint(db, {
      phase_id: phases[0]!.id,
      type: 'file',
      path: 'src/database/schema.sql',
      style: 'suggested',
      hover_text: 'Look at this file for the schema definition',
      required_level: 'low',
    });

    expect(fileHint.id).toBeTypeOf('number');
    expect(fileHint.id).toBeGreaterThan(0);
    expect(fileHint.phase_id).toBe(phases[0]!.id);
    expect(fileHint.type).toBe('file');
    expect(fileHint.path).toBe('src/database/schema.sql');
    expect(fileHint.line_start).toBeNull();
    expect(fileHint.line_end).toBeNull();
    expect(fileHint.style).toBe('suggested');
    expect(fileHint.hover_text).toBe('Look at this file for the schema definition');
    expect(fileHint.required_level).toBe('low');
  });

  it('creates a line hint for phase 1', async () => {
    lineHint = await createHint(db, {
      phase_id: phases[0]!.id,
      type: 'line',
      path: 'src/database/schema.sql',
      line_start: 10,
      line_end: 25,
      style: 'warning',
      hover_text: 'The column definition needs a NOT NULL constraint',
      required_level: 'medium',
    });

    expect(lineHint.id).toBeTypeOf('number');
    expect(lineHint.type).toBe('line');
    expect(lineHint.line_start).toBe(10);
    expect(lineHint.line_end).toBe(25);
    expect(lineHint.style).toBe('warning');
    expect(lineHint.required_level).toBe('medium');
  });

  it('retrieves all hints for phase 1', async () => {
    const hints = await getHintsByPhase(db, phases[0]!.id);

    expect(hints).toHaveLength(2);

    const types = hints.map((h) => h.type).sort();
    expect(types).toEqual(['file', 'line']);
  });

  it('returns empty hints for a phase with no hints', async () => {
    const hints = await getHintsByPhase(db, phases[1]!.id);

    expect(hints).toHaveLength(0);
  });

  // ── Step 5: Add progress events ──────────────────────────────────────────

  it('creates a hint_used progress event', async () => {
    const now = new Date().toISOString();

    const event = await createProgressEvent(db, {
      phase_id: phases[0]!.id,
      event_type: 'hint_used',
      data: JSON.stringify({ hint_id: fileHint.id, hint_level: 'low' }),
      created_at: now,
    });

    expect(event.id).toBeTypeOf('number');
    expect(event.id).toBeGreaterThan(0);
    expect(event.phase_id).toBe(phases[0]!.id);
    expect(event.event_type).toBe('hint_used');
    expect(event.created_at).toBe(now);

    // Verify JSON data round-trips correctly
    const parsed = JSON.parse(event.data!) as { hint_id: number; hint_level: string };
    expect(parsed.hint_id).toBe(fileHint.id);
    expect(parsed.hint_level).toBe('low');
  });

  it('creates a review_requested progress event with null data', async () => {
    const now = new Date().toISOString();

    const event = await createProgressEvent(db, {
      phase_id: phases[0]!.id,
      event_type: 'review_requested',
      created_at: now,
    });

    expect(event.id).toBeTypeOf('number');
    expect(event.event_type).toBe('review_requested');
    expect(event.data).toBeNull();
  });

  it('retrieves progress events by phase ID', async () => {
    const events = await getProgressEventsByPhase(db, phases[0]!.id);

    expect(events).toHaveLength(2);

    const types = events.map((e) => e.event_type);
    expect(types).toContain('hint_used');
    expect(types).toContain('review_requested');
  });

  it('returns empty progress events for a phase with no events', async () => {
    const events = await getProgressEventsByPhase(db, phases[2]!.id);

    expect(events).toHaveLength(0);
  });

  // ── Step 6: Query session with all relationships ──────────────────────────

  it('verifies the full session hierarchy', async () => {
    // Session exists
    const fetchedSession = await getSession(db, session.id);
    expect(fetchedSession).toBeDefined();
    expect(fetchedSession!.status).toBe('active');

    // Session -> Plans
    const plans = await getPlansBySession(db, session.id);
    expect(plans).toHaveLength(1);

    // Plan -> Phases
    const fetchedPhases = await getPhasesByPlan(db, plans[0]!.id);
    expect(fetchedPhases).toHaveLength(3);

    // Phase 1 -> Hints
    const hints = await getHintsByPhase(db, fetchedPhases[0]!.id);
    expect(hints).toHaveLength(2);

    // Phase 1 -> Progress Events
    const events = await getProgressEventsByPhase(db, fetchedPhases[0]!.id);
    expect(events).toHaveLength(2);

    // Phase 2 -> No hints, no events
    const phase2Hints = await getHintsByPhase(db, fetchedPhases[1]!.id);
    const phase2Events = await getProgressEventsByPhase(db, fetchedPhases[1]!.id);
    expect(phase2Hints).toHaveLength(0);
    expect(phase2Events).toHaveLength(0);
  });

  // ── Step 7: Complete the session ──────────────────────────────────────────

  it('updates session status to completed with ended_at timestamp', async () => {
    const endedAt = new Date().toISOString();

    const updated = await updateSession(db, session.id, {
      status: 'completed',
      ended_at: endedAt,
    });

    expect(updated.id).toBe(session.id);
    expect(updated.status).toBe('completed');
    expect(updated.ended_at).toBe(endedAt);
    // Other fields should remain unchanged
    expect(updated.project_dir).toBe('/tmp/test-project');
    expect(updated.started_at).toBe(session.started_at);
  });

  it('persists the completed status on re-fetch', async () => {
    const fetched = await getSession(db, session.id);

    expect(fetched).toBeDefined();
    expect(fetched!.status).toBe('completed');
    expect(fetched!.ended_at).not.toBeNull();
  });

  // ── Step 8: Foreign key integrity ─────────────────────────────────────────

  it('rejects a plan with non-existent session_id', async () => {
    await expect(
      createPlan(db, {
        session_id: 999_999, // Does not exist
        title: 'Orphan plan',
        description: 'Should fail FK constraint',
        total_phases: 1,
        created_at: new Date().toISOString(),
      }),
    ).rejects.toThrow();
  });

  it('rejects a phase with non-existent plan_id', async () => {
    await expect(
      createPhase(db, {
        plan_id: 999_999, // Does not exist
        number: 1,
        title: 'Orphan phase',
        description: 'Should fail FK constraint',
        hint_level: 'off',
        status: 'pending',
      }),
    ).rejects.toThrow();
  });

  it('rejects a hint with non-existent phase_id', async () => {
    await expect(
      createHint(db, {
        phase_id: 999_999, // Does not exist
        type: 'file',
        path: 'nonexistent.ts',
        style: 'suggested',
        required_level: 'low',
      }),
    ).rejects.toThrow();
  });

  it('rejects a progress event with non-existent phase_id', async () => {
    await expect(
      createProgressEvent(db, {
        phase_id: 999_999, // Does not exist
        event_type: 'hint_used',
        created_at: new Date().toISOString(),
      }),
    ).rejects.toThrow();
  });

  it('returns undefined for a non-existent session ID', async () => {
    const result = await getSession(db, 999_999);

    expect(result).toBeUndefined();
  });
});
