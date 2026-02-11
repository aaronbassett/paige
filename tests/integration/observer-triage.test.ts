// Integration test for Observer triage system (US10, T315)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ── Mock external dependencies ──────────────────────────────────────────────
//
// The Observer calls runTriage (which hits Claude Haiku), deliverNudge and
// broadcastObserverStatus (which need a WebSocket server), and logAction
// (which writes to the database). We mock triage and nudge delivery to avoid
// real API/WS calls but use real logAction + SQLite for integration testing.
// We spy on logAction to assert it was called with the correct action types.

vi.mock('../../src/observer/triage.js', () => ({
  runTriage: vi.fn(),
}));

vi.mock('../../src/observer/nudge.js', () => ({
  deliverNudge: vi.fn(),
  broadcastObserverStatus: vi.fn(),
}));

// ── Import modules under test AFTER mocking ────────────────────────────────

import { runTriage, type TriageResult } from '../../src/observer/triage.js';
import { deliverNudge, broadcastObserverStatus } from '../../src/observer/nudge.js';
import { actionEvents, type ActionEventPayload } from '../../src/logger/action-log.js';
import { createDatabase, closeDatabase, type AppDatabase } from '../../src/database/db.js';
import { createSession } from '../../src/database/queries/sessions.js';
import { getActionsByType } from '../../src/database/queries/actions.js';
import { Observer, type ObserverOptions } from '../../src/observer/observer.js';
import type { ActionType } from '../../src/types/domain.js';

// ── Type-safe mock references ──────────────────────────────────────────────

const mockRunTriage = vi.mocked(runTriage);
const mockDeliverNudge = vi.mocked(deliverNudge);
const mockBroadcastObserverStatus = vi.mocked(broadcastObserverStatus);

// ── Helpers ────────────────────────────────────────────────────────────────

/** Builds a default triage result indicating the user should NOT be nudged. */
function noNudgeResult(): TriageResult {
  return {
    should_nudge: false,
    confidence: 0.3,
    signal: 'on_track',
    reasoning: 'User is progressing normally',
  };
}

/** Builds a triage result indicating the user SHOULD be nudged. */
function nudgeResult(overrides?: Partial<TriageResult>): TriageResult {
  return {
    should_nudge: true,
    confidence: 0.8,
    signal: 'stuck_on_implementation',
    reasoning: 'User has been idle on the same file for a while',
    ...overrides,
  };
}

/** Emits a synthetic action event as the action log EventEmitter would. */
function emitAction(
  sessionId: number,
  actionType: ActionType,
  data?: Record<string, unknown>,
): void {
  const payload: ActionEventPayload = {
    sessionId,
    actionType,
    data,
    createdAt: new Date().toISOString(),
  };
  actionEvents.emit('action', payload);
}

/**
 * Waits for async work triggered by an EventEmitter event to settle.
 * The Observer listener calls async runTriage internally; we need to yield
 * the microtask queue so the Promise chain completes before assertions.
 */
function waitForAsync(ms = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('Observer triage system (integration)', () => {
  let tmpDir: string;
  let dbPath: string;
  let db: AppDatabase;
  let sessionId: number;
  let observer: Observer;

  const defaultOptions: () => ObserverOptions = () => ({
    sessionId,
    cooldownMs: 60_000,
    confidenceThreshold: 0.7,
    bufferUpdateTriggerCount: 5,
    explainRequestTriggerCount: 3,
  });

  beforeEach(async () => {
    // Create real SQLite database with all migrations
    tmpDir = mkdtempSync(join(tmpdir(), 'paige-observer-triage-'));
    dbPath = join(tmpDir, 'test.db');
    db = await createDatabase(dbPath);

    // Create a session to satisfy FK constraints
    const session = await createSession(db, {
      project_dir: tmpDir,
      status: 'active',
      started_at: new Date().toISOString(),
    });
    sessionId = session.id;

    // Default mock: runTriage returns no-nudge
    mockRunTriage.mockResolvedValue(noNudgeResult());
    mockDeliverNudge.mockReturnValue(undefined);
    mockBroadcastObserverStatus.mockReturnValue(undefined);
  });

  afterEach(async () => {
    // Stop the observer to unsubscribe from events
    if (observer?.isActive()) {
      observer.stop();
    }
    actionEvents.removeAllListeners();
    mockRunTriage.mockReset();
    mockDeliverNudge.mockReset();
    mockBroadcastObserverStatus.mockReset();
    await closeDatabase();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Test 1: Observer starts and subscribes ──────────────────────────────────

  it('starts and reports isActive() as true', () => {
    observer = new Observer(defaultOptions());

    expect(observer.isActive()).toBe(false);

    observer.start();

    expect(observer.isActive()).toBe(true);
  });

  // ── Test 2: Observer stops and unsubscribes ─────────────────────────────────

  it('stops and reports isActive() as false', () => {
    observer = new Observer(defaultOptions());
    observer.start();

    expect(observer.isActive()).toBe(true);

    observer.stop();

    expect(observer.isActive()).toBe(false);
  });

  it('does not process events after stop', async () => {
    observer = new Observer(defaultOptions());
    observer.start();
    observer.stop();

    // Emit a file_open — should NOT trigger triage because observer is stopped
    emitAction(sessionId, 'file_open', { filePath: 'src/index.ts' });
    await waitForAsync();

    expect(mockRunTriage).not.toHaveBeenCalled();
  });

  // ── Test 3: file_open triggers triage ───────────────────────────────────────

  it('triggers triage on file_open action', async () => {
    observer = new Observer(defaultOptions());
    observer.start();

    emitAction(sessionId, 'file_open', { filePath: 'src/index.ts' });
    await waitForAsync();

    expect(mockRunTriage).toHaveBeenCalledTimes(1);

    // Verify the triage context includes the session ID
    const context = mockRunTriage.mock.calls[0]![0];
    expect(context.sessionId).toBe(sessionId);
  });

  it('triggers triage on every file_open, not just the first', async () => {
    observer = new Observer(defaultOptions());
    observer.start();

    emitAction(sessionId, 'file_open', { filePath: 'src/a.ts' });
    await waitForAsync();
    emitAction(sessionId, 'file_open', { filePath: 'src/b.ts' });
    await waitForAsync();
    emitAction(sessionId, 'file_open', { filePath: 'src/c.ts' });
    await waitForAsync();

    expect(mockRunTriage).toHaveBeenCalledTimes(3);
  });

  // ── Test 4: buffer_summary triggers triage on 5th occurrence ────────────────

  it('does NOT trigger triage on buffer_summary updates 1 through 4', async () => {
    observer = new Observer(defaultOptions());
    observer.start();

    for (let i = 0; i < 4; i++) {
      emitAction(sessionId, 'buffer_summary', { path: 'src/index.ts', editCount: i + 1 });
      await waitForAsync();
    }

    expect(mockRunTriage).not.toHaveBeenCalled();
  });

  it('triggers triage on the 5th buffer_summary update', async () => {
    observer = new Observer(defaultOptions());
    observer.start();

    for (let i = 0; i < 5; i++) {
      emitAction(sessionId, 'buffer_summary', { path: 'src/index.ts', editCount: i + 1 });
      await waitForAsync();
    }

    expect(mockRunTriage).toHaveBeenCalledTimes(1);
  });

  it('triggers triage again on the 10th buffer_summary (counter cycles every 5)', async () => {
    observer = new Observer(defaultOptions());
    observer.start();

    for (let i = 0; i < 10; i++) {
      emitAction(sessionId, 'buffer_summary', { path: 'src/index.ts', editCount: i + 1 });
      await waitForAsync();
    }

    expect(mockRunTriage).toHaveBeenCalledTimes(2);
  });

  it('also counts buffer_significant_change toward the buffer update trigger', async () => {
    observer = new Observer(defaultOptions());
    observer.start();

    // Mix buffer_summary and buffer_significant_change — both should count
    emitAction(sessionId, 'buffer_summary', { path: 'a.ts' });
    await waitForAsync();
    emitAction(sessionId, 'buffer_significant_change', { path: 'a.ts' });
    await waitForAsync();
    emitAction(sessionId, 'buffer_summary', { path: 'b.ts' });
    await waitForAsync();
    emitAction(sessionId, 'buffer_significant_change', { path: 'b.ts' });
    await waitForAsync();
    emitAction(sessionId, 'buffer_summary', { path: 'c.ts' });
    await waitForAsync();

    expect(mockRunTriage).toHaveBeenCalledTimes(1);
  });

  // ── Test 5: user_explain_request triggers triage on 3rd occurrence ──────────

  it('does NOT trigger triage on user_explain_request until the 3rd', async () => {
    observer = new Observer(defaultOptions());
    observer.start();

    emitAction(sessionId, 'user_explain_request', { topic: 'closures' });
    await waitForAsync();
    emitAction(sessionId, 'user_explain_request', { topic: 'promises' });
    await waitForAsync();

    expect(mockRunTriage).not.toHaveBeenCalled();
  });

  it('triggers triage on the 3rd user_explain_request', async () => {
    observer = new Observer(defaultOptions());
    observer.start();

    for (let i = 0; i < 3; i++) {
      emitAction(sessionId, 'user_explain_request', { topic: `topic-${i}` });
      await waitForAsync();
    }

    expect(mockRunTriage).toHaveBeenCalledTimes(1);
  });

  it('triggers triage again on the 6th user_explain_request (counter cycles every 3)', async () => {
    observer = new Observer(defaultOptions());
    observer.start();

    for (let i = 0; i < 6; i++) {
      emitAction(sessionId, 'user_explain_request', { topic: `topic-${i}` });
      await waitForAsync();
    }

    expect(mockRunTriage).toHaveBeenCalledTimes(2);
  });

  // ── Test 6: phase_completed triggers triage ─────────────────────────────────

  it('triggers triage on phase_completed action', async () => {
    observer = new Observer(defaultOptions());
    observer.start();

    emitAction(sessionId, 'phase_completed', { phaseNumber: 1, phaseTitle: 'Setup' });
    await waitForAsync();

    expect(mockRunTriage).toHaveBeenCalledTimes(1);
  });

  it('resets the buffer update counter on phase_completed', async () => {
    observer = new Observer(defaultOptions());
    observer.start();

    // Emit 3 buffer updates (not yet at 5 threshold)
    for (let i = 0; i < 3; i++) {
      emitAction(sessionId, 'buffer_summary', { path: 'src/index.ts' });
      await waitForAsync();
    }
    expect(mockRunTriage).not.toHaveBeenCalled();

    // Emit phase_completed — triggers triage AND resets buffer counter
    emitAction(sessionId, 'phase_completed', { phaseNumber: 1 });
    await waitForAsync();
    expect(mockRunTriage).toHaveBeenCalledTimes(1);

    mockRunTriage.mockClear();

    // Now need a full 5 more buffer updates to trigger again (not 2)
    for (let i = 0; i < 4; i++) {
      emitAction(sessionId, 'buffer_summary', { path: 'src/index.ts' });
      await waitForAsync();
    }
    expect(mockRunTriage).not.toHaveBeenCalled();

    emitAction(sessionId, 'buffer_summary', { path: 'src/index.ts' });
    await waitForAsync();
    expect(mockRunTriage).toHaveBeenCalledTimes(1);
  });

  // ── Test 7: Nudge delivery on high-confidence should_nudge ──────────────────

  it('delivers nudge when should_nudge is true and confidence >= threshold', async () => {
    mockRunTriage.mockResolvedValue(
      nudgeResult({ should_nudge: true, confidence: 0.8, signal: 'stuck_on_implementation' }),
    );

    observer = new Observer(defaultOptions());
    observer.start();

    emitAction(sessionId, 'file_open', { filePath: 'src/app.ts' });
    await waitForAsync();

    expect(mockDeliverNudge).toHaveBeenCalledTimes(1);

    const nudgePayload = mockDeliverNudge.mock.calls[0]![0];
    expect(nudgePayload.signal).toBe('stuck_on_implementation');
    expect(nudgePayload.confidence).toBe(0.8);
  });

  it('does NOT deliver nudge when should_nudge is true but confidence < threshold', async () => {
    mockRunTriage.mockResolvedValue(
      nudgeResult({ should_nudge: true, confidence: 0.5, signal: 'maybe_stuck' }),
    );

    observer = new Observer(defaultOptions());
    observer.start();

    emitAction(sessionId, 'file_open', { filePath: 'src/app.ts' });
    await waitForAsync();

    expect(mockDeliverNudge).not.toHaveBeenCalled();
  });

  it('does NOT deliver nudge when should_nudge is false regardless of confidence', async () => {
    mockRunTriage.mockResolvedValue({
      should_nudge: false,
      confidence: 0.95,
      signal: 'on_track',
      reasoning: 'User is fine',
    });

    observer = new Observer(defaultOptions());
    observer.start();

    emitAction(sessionId, 'file_open', { filePath: 'src/app.ts' });
    await waitForAsync();

    expect(mockDeliverNudge).not.toHaveBeenCalled();
  });

  // ── Test 8: Triage result logged as observer_triage ─────────────────────────

  it('logs observer_triage action after triage completes', async () => {
    const triageResult = noNudgeResult();
    mockRunTriage.mockResolvedValue(triageResult);

    observer = new Observer(defaultOptions());
    observer.start();

    emitAction(sessionId, 'file_open', { filePath: 'src/index.ts' });
    await waitForAsync();

    // Query the database for observer_triage actions
    const triageActions = await getActionsByType(db, sessionId, 'observer_triage');
    expect(triageActions.length).toBeGreaterThanOrEqual(1);

    const action = triageActions[0]!;
    expect(action.session_id).toBe(sessionId);
    expect(action.action_type).toBe('observer_triage');

    // Verify the logged data contains triage result fields
    const loggedData = JSON.parse(action.data!) as Record<string, unknown>;
    expect(loggedData).toHaveProperty('should_nudge', false);
    expect(loggedData).toHaveProperty('confidence');
    expect(loggedData).toHaveProperty('signal', 'on_track');
  });

  // ── Test 9: Successful nudge logged as nudge_sent ───────────────────────────

  it('logs nudge_sent action when nudge is delivered', async () => {
    mockRunTriage.mockResolvedValue(
      nudgeResult({ should_nudge: true, confidence: 0.85, signal: 'stuck_on_implementation' }),
    );

    observer = new Observer(defaultOptions());
    observer.start();

    emitAction(sessionId, 'file_open', { filePath: 'src/app.ts' });
    await waitForAsync();

    // Verify nudge was delivered
    expect(mockDeliverNudge).toHaveBeenCalledTimes(1);

    // Query the database for nudge_sent actions
    const nudgeActions = await getActionsByType(db, sessionId, 'nudge_sent');
    expect(nudgeActions.length).toBeGreaterThanOrEqual(1);

    const action = nudgeActions[0]!;
    expect(action.session_id).toBe(sessionId);
    expect(action.action_type).toBe('nudge_sent');

    const loggedData = JSON.parse(action.data!) as Record<string, unknown>;
    expect(loggedData).toHaveProperty('signal', 'stuck_on_implementation');
    expect(loggedData).toHaveProperty('confidence', 0.85);
  });

  it('logs nudge_suppressed when confidence is below threshold', async () => {
    mockRunTriage.mockResolvedValue(
      nudgeResult({ should_nudge: true, confidence: 0.5, signal: 'maybe_stuck' }),
    );

    observer = new Observer(defaultOptions());
    observer.start();

    emitAction(sessionId, 'file_open', { filePath: 'src/app.ts' });
    await waitForAsync();

    // Nudge should NOT have been delivered
    expect(mockDeliverNudge).not.toHaveBeenCalled();

    // But nudge_suppressed should be logged
    const suppressedActions = await getActionsByType(db, sessionId, 'nudge_suppressed');
    expect(suppressedActions.length).toBeGreaterThanOrEqual(1);

    const action = suppressedActions[0]!;
    expect(action.action_type).toBe('nudge_suppressed');

    const loggedData = JSON.parse(action.data!) as Record<string, unknown>;
    expect(loggedData).toHaveProperty('reason', 'low_confidence');
  });

  // ── Test 10: Triage failure does not crash Observer ─────────────────────────

  it('continues operating after runTriage rejects with an error', async () => {
    // First call: reject
    mockRunTriage.mockRejectedValueOnce(new Error('Haiku API timeout'));
    // Second call: succeed
    mockRunTriage.mockResolvedValueOnce(noNudgeResult());

    observer = new Observer(defaultOptions());
    observer.start();

    // First event — triage will fail, but Observer should NOT crash
    emitAction(sessionId, 'file_open', { filePath: 'src/broken.ts' });
    await waitForAsync();

    // Observer should still be active
    expect(observer.isActive()).toBe(true);

    // Second event — triage should succeed, proving the Observer recovered
    emitAction(sessionId, 'file_open', { filePath: 'src/recovery.ts' });
    await waitForAsync();

    expect(mockRunTriage).toHaveBeenCalledTimes(2);
  });

  // ── Cooldown: Nudge suppressed during cooldown window ───────────────────────

  it('suppresses nudge during cooldown period after a successful nudge', async () => {
    // Use a short cooldown for testing
    const shortCooldownMs = 500;
    mockRunTriage.mockResolvedValue(nudgeResult());

    observer = new Observer({ ...defaultOptions(), cooldownMs: shortCooldownMs });
    observer.start();

    // First file_open — should deliver nudge
    emitAction(sessionId, 'file_open', { filePath: 'src/a.ts' });
    await waitForAsync();

    expect(mockDeliverNudge).toHaveBeenCalledTimes(1);

    // Second file_open immediately after — should be suppressed (cooldown)
    emitAction(sessionId, 'file_open', { filePath: 'src/b.ts' });
    await waitForAsync();

    // deliverNudge should still only have been called once
    expect(mockDeliverNudge).toHaveBeenCalledTimes(1);

    // Verify nudge_suppressed was logged with cooldown reason
    const suppressedActions = await getActionsByType(db, sessionId, 'nudge_suppressed');
    const cooldownSuppressed = suppressedActions.find((a) => {
      const data = JSON.parse(a.data!) as Record<string, unknown>;
      return data.reason === 'cooldown';
    });
    expect(cooldownSuppressed).toBeDefined();
  });

  // ── Muting: Observer respects muted state ───────────────────────────────────

  it('does not trigger triage when muted', async () => {
    observer = new Observer(defaultOptions());
    observer.start();
    observer.setMuted(true);

    expect(observer.isMuted()).toBe(true);

    emitAction(sessionId, 'file_open', { filePath: 'src/index.ts' });
    await waitForAsync();

    expect(mockRunTriage).not.toHaveBeenCalled();
  });

  it('resumes triggering triage after being unmuted', async () => {
    observer = new Observer(defaultOptions());
    observer.start();
    observer.setMuted(true);

    emitAction(sessionId, 'file_open', { filePath: 'src/a.ts' });
    await waitForAsync();
    expect(mockRunTriage).not.toHaveBeenCalled();

    observer.setMuted(false);
    expect(observer.isMuted()).toBe(false);

    emitAction(sessionId, 'file_open', { filePath: 'src/b.ts' });
    await waitForAsync();
    expect(mockRunTriage).toHaveBeenCalledTimes(1);
  });

  // ── Session filtering: Observer ignores actions from other sessions ──────────

  it('ignores actions from a different session ID', async () => {
    // Create a second session
    const otherSession = await createSession(db, {
      project_dir: tmpDir,
      status: 'active',
      started_at: new Date().toISOString(),
    });

    observer = new Observer(defaultOptions());
    observer.start();

    // Emit action for a DIFFERENT session — should be ignored
    emitAction(otherSession.id, 'file_open', { filePath: 'src/other.ts' });
    await waitForAsync();

    expect(mockRunTriage).not.toHaveBeenCalled();

    // Emit action for OUR session — should trigger triage
    emitAction(sessionId, 'file_open', { filePath: 'src/mine.ts' });
    await waitForAsync();

    expect(mockRunTriage).toHaveBeenCalledTimes(1);
  });

  // ── Non-triggering actions: Irrelevant types do NOT trigger triage ──────────

  it('does not trigger triage for non-triggering action types', async () => {
    observer = new Observer(defaultOptions());
    observer.start();

    // These action types should NOT trigger triage
    const nonTriggeringTypes: ActionType[] = [
      'file_save',
      'file_close',
      'file_create',
      'file_delete',
      'editor_tab_switch',
      'editor_selection',
      'session_started',
      'session_ended',
      'mcp_tool_call',
      'coaching_pipeline_run',
    ];

    for (const actionType of nonTriggeringTypes) {
      emitAction(sessionId, actionType, { test: true });
      await waitForAsync();
    }

    expect(mockRunTriage).not.toHaveBeenCalled();
  });

  // ── Custom trigger counts via options ───────────────────────────────────────

  it('respects custom bufferUpdateTriggerCount option', async () => {
    observer = new Observer({
      ...defaultOptions(),
      bufferUpdateTriggerCount: 3,
    });
    observer.start();

    // With trigger count set to 3, triage fires on 3rd buffer update
    for (let i = 0; i < 2; i++) {
      emitAction(sessionId, 'buffer_summary', { path: 'src/index.ts' });
      await waitForAsync();
    }
    expect(mockRunTriage).not.toHaveBeenCalled();

    emitAction(sessionId, 'buffer_summary', { path: 'src/index.ts' });
    await waitForAsync();
    expect(mockRunTriage).toHaveBeenCalledTimes(1);
  });

  it('respects custom explainRequestTriggerCount option', async () => {
    observer = new Observer({
      ...defaultOptions(),
      explainRequestTriggerCount: 2,
    });
    observer.start();

    // With trigger count set to 2, triage fires on 2nd explain request
    emitAction(sessionId, 'user_explain_request', { topic: 'closures' });
    await waitForAsync();
    expect(mockRunTriage).not.toHaveBeenCalled();

    emitAction(sessionId, 'user_explain_request', { topic: 'promises' });
    await waitForAsync();
    expect(mockRunTriage).toHaveBeenCalledTimes(1);
  });
});
