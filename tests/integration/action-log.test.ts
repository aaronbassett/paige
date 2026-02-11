import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase, closeDatabase, type AppDatabase } from '../../src/database/db.js';
import { createSession } from '../../src/database/queries/sessions.js';
import { logAction, actionEvents, type ActionEventPayload } from '../../src/logger/action-log.js';
import { logApiCall, getSessionCost, MODEL_PRICING } from '../../src/logger/api-log.js';
import type { ActionLogEntry, ApiCallLogEntry } from '../../src/types/domain.js';

// These query functions do NOT exist yet — imports will cause failures (TDD).
import {
  getActionsBySession,
  getActionsByType,
  getRecentActions,
} from '../../src/database/queries/actions.js';

/**
 * Integration tests for US4: Action Logging & API Call Logging.
 *
 * Tests 1-4 exercise existing modules (logAction, actionEvents, logApiCall, getSessionCost).
 * Tests 5-7 import from `src/database/queries/actions.ts` which does NOT exist yet,
 * so they will fail at import time. This is intentional TDD — the implementation
 * step creates that module to make these tests pass.
 */

describe('Action logging (integration)', () => {
  let tmpDir: string;
  let dbPath: string;
  let db: AppDatabase;
  let sessionId: number;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'paige-action-log-'));
    dbPath = join(tmpDir, 'test.db');
    db = await createDatabase(dbPath);

    // Create a session to satisfy FK constraints on action_log and api_call_log
    const session = await createSession(db, {
      project_dir: '/tmp/test-project',
      status: 'active',
      started_at: new Date().toISOString(),
    });
    sessionId = session.id;
  });

  afterEach(async () => {
    actionEvents.removeAllListeners();
    await closeDatabase();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Test 1: Action logging inserts correctly ────────────────────────────────

  it('inserts an action log entry with correct fields', async () => {
    const data = { filePath: '/tmp/test-project/src/index.ts', lineCount: 42 };

    await logAction(db, sessionId, 'file_open', data);

    // Query the table directly to verify the row
    const rows = (await db
      .selectFrom('action_log')
      .selectAll()
      .where('session_id', '=', sessionId)
      .execute()) as ActionLogEntry[];

    expect(rows).toHaveLength(1);

    const row = rows[0]!;
    expect(row.session_id).toBe(sessionId);
    expect(row.action_type).toBe('file_open');
    expect(row.created_at).toBeTruthy();
    expect(row.id).toBeTypeOf('number');
    expect(row.id).toBeGreaterThan(0);

    // Verify JSON data round-trips correctly
    const parsed = JSON.parse(row.data!) as { filePath: string; lineCount: number };
    expect(parsed.filePath).toBe('/tmp/test-project/src/index.ts');
    expect(parsed.lineCount).toBe(42);
  });

  it('inserts an action log entry with null data when data is omitted', async () => {
    await logAction(db, sessionId, 'session_started');

    const rows = (await db
      .selectFrom('action_log')
      .selectAll()
      .where('session_id', '=', sessionId)
      .execute()) as ActionLogEntry[];

    expect(rows).toHaveLength(1);
    expect(rows[0]!.action_type).toBe('session_started');
    expect(rows[0]!.data).toBeNull();
  });

  // ── Test 2: Action event emission ──────────────────────────────────────────

  it('emits an action event with correct payload when logging', async () => {
    const receivedPayloads: ActionEventPayload[] = [];
    actionEvents.on('action', (payload: ActionEventPayload) => {
      receivedPayloads.push(payload);
    });

    const data = { filePath: 'src/app.ts' };
    await logAction(db, sessionId, 'file_open', data);

    expect(receivedPayloads).toHaveLength(1);

    const payload = receivedPayloads[0]!;
    expect(payload.sessionId).toBe(sessionId);
    expect(payload.actionType).toBe('file_open');
    expect(payload.data).toEqual({ filePath: 'src/app.ts' });
    expect(payload.createdAt).toBeTruthy();
    // createdAt should be a valid ISO 8601 string
    expect(new Date(payload.createdAt).toISOString()).toBe(payload.createdAt);
  });

  it('emits an action event with undefined data when data is omitted', async () => {
    const receivedPayloads: ActionEventPayload[] = [];
    actionEvents.on('action', (payload: ActionEventPayload) => {
      receivedPayloads.push(payload);
    });

    await logAction(db, sessionId, 'session_ended');

    expect(receivedPayloads).toHaveLength(1);
    expect(receivedPayloads[0]!.data).toBeUndefined();
  });

  // ── Test 3: API call logging with cost ─────────────────────────────────────

  it('logs an API call with correct cost estimate', async () => {
    const model = 'claude-sonnet-4-5-20250929';
    const inputTokens = 1000;
    const outputTokens = 500;

    await logApiCall(db, {
      sessionId,
      callType: 'coach_agent',
      model,
      latencyMs: 1200,
      inputTokens,
      outputTokens,
    });

    const rows = (await db
      .selectFrom('api_call_log')
      .selectAll()
      .where('session_id', '=', sessionId)
      .execute()) as ApiCallLogEntry[];

    expect(rows).toHaveLength(1);

    const row = rows[0]!;
    expect(row.session_id).toBe(sessionId);
    expect(row.call_type).toBe('coach_agent');
    expect(row.model).toBe(model);
    expect(row.latency_ms).toBe(1200);
    expect(row.input_tokens).toBe(1000);
    expect(row.output_tokens).toBe(500);
    expect(row.input_hash).toBeNull();
    expect(row.created_at).toBeTruthy();

    // Verify cost calculation: (1000/1000)*0.003 + (500/1000)*0.015 = 0.003 + 0.0075 = 0.0105
    const pricing = MODEL_PRICING[model]!;
    const expectedCost =
      (inputTokens / 1000) * pricing.inputPer1k + (outputTokens / 1000) * pricing.outputPer1k;
    expect(expectedCost).toBeCloseTo(0.0105, 6);
    expect(row.cost_estimate).toBeCloseTo(expectedCost, 6);
  });

  it('logs an API call with zero cost for an unknown model', async () => {
    await logApiCall(db, {
      sessionId,
      callType: 'explain_this',
      model: 'unknown-model-xyz',
      latencyMs: 800,
      inputTokens: 500,
      outputTokens: 200,
    });

    const rows = (await db
      .selectFrom('api_call_log')
      .selectAll()
      .where('session_id', '=', sessionId)
      .execute()) as ApiCallLogEntry[];

    expect(rows).toHaveLength(1);
    expect(rows[0]!.cost_estimate).toBe(0);
  });

  // ── Test 4: Session cost aggregation ───────────────────────────────────────

  it('aggregates total cost across multiple API calls in a session', async () => {
    const model = 'claude-sonnet-4-5-20250929';
    const pricing = MODEL_PRICING[model]!;

    // Call 1: 1000 input, 500 output
    await logApiCall(db, {
      sessionId,
      callType: 'coach_agent',
      model,
      latencyMs: 1000,
      inputTokens: 1000,
      outputTokens: 500,
    });

    // Call 2: 2000 input, 1000 output
    await logApiCall(db, {
      sessionId,
      callType: 'reflection_agent',
      model,
      latencyMs: 1500,
      inputTokens: 2000,
      outputTokens: 1000,
    });

    // Call 3: 500 input, 250 output
    await logApiCall(db, {
      sessionId,
      callType: 'knowledge_gap_agent',
      model,
      latencyMs: 900,
      inputTokens: 500,
      outputTokens: 250,
    });

    // Expected costs:
    // Call 1: (1000/1000)*0.003 + (500/1000)*0.015  = 0.003 + 0.0075  = 0.0105
    // Call 2: (2000/1000)*0.003 + (1000/1000)*0.015 = 0.006 + 0.015   = 0.021
    // Call 3: (500/1000)*0.003  + (250/1000)*0.015   = 0.0015 + 0.00375 = 0.00525
    // Total: 0.0105 + 0.021 + 0.00525 = 0.03675
    const expectedTotal =
      (1000 / 1000) * pricing.inputPer1k +
      (500 / 1000) * pricing.outputPer1k +
      (2000 / 1000) * pricing.inputPer1k +
      (1000 / 1000) * pricing.outputPer1k +
      (500 / 1000) * pricing.inputPer1k +
      (250 / 1000) * pricing.outputPer1k;

    const totalCost = await getSessionCost(db, sessionId);

    expect(totalCost).toBeCloseTo(expectedTotal, 6);
    expect(totalCost).toBeCloseTo(0.03675, 6);
  });

  it('returns 0 for a session with no API calls', async () => {
    const totalCost = await getSessionCost(db, sessionId);

    expect(totalCost).toBe(0);
  });

  // ── Test 5: Query actions by session (MUST FAIL) ──────────────────────────

  it('retrieves actions filtered by session ID', async () => {
    // Insert actions for two different sessions
    const session2 = await createSession(db, {
      project_dir: '/tmp/other-project',
      status: 'active',
      started_at: new Date().toISOString(),
    });

    await logAction(db, sessionId, 'file_open', { filePath: 'a.ts' });
    await logAction(db, sessionId, 'file_save', { filePath: 'a.ts' });
    await logAction(db, session2.id, 'file_open', { filePath: 'b.ts' });

    // This function doesn't exist yet — import will fail
    const actions = await getActionsBySession(db, sessionId);

    expect(actions).toHaveLength(2);
    for (const action of actions) {
      expect(action.session_id).toBe(sessionId);
    }
  });

  // ── Test 6: Query actions by type (MUST FAIL) ─────────────────────────────

  it('retrieves actions filtered by action type', async () => {
    await logAction(db, sessionId, 'file_open', { filePath: 'a.ts' });
    await logAction(db, sessionId, 'file_save', { filePath: 'a.ts' });
    await logAction(db, sessionId, 'file_open', { filePath: 'b.ts' });
    await logAction(db, sessionId, 'session_started');

    // This function doesn't exist yet — import will fail
    const actions = await getActionsByType(db, sessionId, 'file_open');

    expect(actions).toHaveLength(2);
    for (const action of actions) {
      expect(action.action_type).toBe('file_open');
      expect(action.session_id).toBe(sessionId);
    }
  });

  // ── Test 7: Query recent actions (MUST FAIL) ──────────────────────────────

  it('retrieves recent actions with limit, ordered by created_at DESC', async () => {
    // Insert several actions
    await logAction(db, sessionId, 'file_open', { filePath: 'a.ts' });
    await logAction(db, sessionId, 'file_save', { filePath: 'a.ts' });
    await logAction(db, sessionId, 'editor_tab_switch', { tab: 'b.ts' });
    await logAction(db, sessionId, 'file_open', { filePath: 'b.ts' });
    await logAction(db, sessionId, 'buffer_summary', { changes: 5 });
    await logAction(db, sessionId, 'file_close', { filePath: 'a.ts' });
    await logAction(db, sessionId, 'session_ended');

    // This function doesn't exist yet — import will fail
    const recent = await getRecentActions(db, sessionId, 5);

    expect(recent).toHaveLength(5);

    // Verify DESC ordering: each entry's created_at should be >= the next
    for (let i = 0; i < recent.length - 1; i++) {
      expect(recent[i]!.created_at >= recent[i + 1]!.created_at).toBe(true);
    }

    // The most recent action should be session_ended (last inserted)
    expect(recent[0]!.action_type).toBe('session_ended');
  });

  it('returns fewer than limit when session has fewer actions', async () => {
    await logAction(db, sessionId, 'file_open', { filePath: 'a.ts' });
    await logAction(db, sessionId, 'file_save', { filePath: 'a.ts' });

    // This function doesn't exist yet — import will fail
    const recent = await getRecentActions(db, sessionId, 10);

    expect(recent).toHaveLength(2);
  });
});
