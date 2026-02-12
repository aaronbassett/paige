// Integration test for Observer nudge suppression system (US10, T316)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock external dependencies ─────────────────────────────────────────────
//
// The Observer depends on triage (Claude Haiku), nudge delivery (WebSocket
// broadcast), status broadcast, and action logging. All are mocked so tests
// never make real API calls or require a running WebSocket server.

vi.mock('../../src/observer/triage.js', () => ({
  runTriage: vi.fn(),
}));

vi.mock('../../src/observer/nudge.js', () => ({
  deliverNudge: vi.fn(),
  broadcastObserverStatus: vi.fn(),
}));

vi.mock('../../src/logger/action-log.js', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const original = await importOriginal<typeof import('../../src/logger/action-log.js')>();
  return {
    ...original,
    // Keep the real actionEvents emitter so we can drive the Observer
    actionEvents: original.actionEvents,
    // Mock logAction to avoid needing a real database for action logging
    logAction: vi.fn(),
  };
});

// ── Import modules under test AFTER mocking ────────────────────────────────

import { Observer, type ObserverOptions } from '../../src/observer/observer.js';
import { runTriage } from '../../src/observer/triage.js';
import { deliverNudge, broadcastObserverStatus } from '../../src/observer/nudge.js';
import { actionEvents, logAction, type ActionEventPayload } from '../../src/logger/action-log.js';
import type { ActionType } from '../../src/types/domain.js';

// ── Type aliases for mock functions ────────────────────────────────────────

const mockRunTriage = runTriage as ReturnType<typeof vi.fn>;
const mockDeliverNudge = deliverNudge as ReturnType<typeof vi.fn>;
const mockBroadcastStatus = broadcastObserverStatus as ReturnType<typeof vi.fn>;
const mockLogAction = logAction as ReturnType<typeof vi.fn>;

// ── Helpers ────────────────────────────────────────────────────────────────

const SESSION_ID = 1;

/** Default options with short timers for test convenience. */
function defaultOptions(overrides?: Partial<ObserverOptions>): ObserverOptions {
  return {
    sessionId: SESSION_ID,
    cooldownMs: 120_000,
    flowStateThreshold: 10,
    flowStateWindowMs: 60_000,
    confidenceThreshold: 0.7,
    ...overrides,
  };
}

/** Emits a single action event for the given session and action type. */
function emitAction(actionType: ActionType, sessionId: number = SESSION_ID): void {
  const payload: ActionEventPayload = {
    sessionId,
    actionType,
    data: undefined,
    createdAt: new Date().toISOString(),
  };
  actionEvents.emit('action', payload);
}

/** Builds a triage result with sensible defaults. */
function triageResult(overrides?: {
  should_nudge?: boolean;
  confidence?: number;
  signal?: string;
  reasoning?: string;
}) {
  return {
    should_nudge: true,
    confidence: 0.9,
    signal: 'stuck_on_phase',
    reasoning: 'User appears stuck on the current phase',
    ...overrides,
  };
}

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('Observer nudge suppression (integration)', () => {
  let observer: Observer;

  beforeEach(() => {
    vi.useFakeTimers();

    // Default: triage returns a high-confidence nudge recommendation
    mockRunTriage.mockResolvedValue(triageResult());
    mockDeliverNudge.mockReturnValue(undefined);
    mockBroadcastStatus.mockReturnValue(undefined);
    mockLogAction.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Stop observer to remove event listeners
    if (observer !== undefined) {
      observer.stop();
    }

    mockRunTriage.mockReset();
    mockDeliverNudge.mockReset();
    mockBroadcastStatus.mockReset();
    mockLogAction.mockReset();

    vi.useRealTimers();
  });

  // ── 1. Cooldown Suppression ──────────────────────────────────────────────

  it('suppresses nudge when previous nudge was sent within cooldown window', async () => {
    observer = new Observer(defaultOptions({ cooldownMs: 120_000 }));
    observer.start();

    // First action triggers triage and nudge delivery
    emitAction('file_open');
    await vi.advanceTimersByTimeAsync(100);

    expect(mockRunTriage).toHaveBeenCalledTimes(1);
    expect(mockDeliverNudge).toHaveBeenCalledTimes(1);

    // Second triage-eligible action within 120s cooldown window
    mockRunTriage.mockResolvedValue(triageResult());
    emitAction('file_open');
    await vi.advanceTimersByTimeAsync(100);

    // Triage is called but nudge must NOT be delivered — suppressed with "cooldown"
    expect(mockDeliverNudge).toHaveBeenCalledTimes(1);

    // Verify nudge_suppressed was logged with reason "cooldown"
    const suppressionCalls = mockLogAction.mock.calls.filter(
      (call: unknown[]) => call[2] === 'nudge_suppressed',
    );
    expect(suppressionCalls.length).toBeGreaterThanOrEqual(1);

    const suppressionData = suppressionCalls[0]![3] as { reason: string };
    expect(suppressionData.reason).toBe('cooldown');
  });

  // ── 2. Cooldown Expiry ─────────────────────────────────────────────────

  it('delivers nudge after cooldown period expires', async () => {
    observer = new Observer(defaultOptions({ cooldownMs: 120_000 }));
    observer.start();

    // First nudge delivered
    emitAction('file_open');
    await vi.advanceTimersByTimeAsync(100);

    expect(mockDeliverNudge).toHaveBeenCalledTimes(1);

    // Advance past cooldown (121 seconds)
    await vi.advanceTimersByTimeAsync(121_000);

    // Second triage-eligible action after cooldown expiry
    mockRunTriage.mockResolvedValue(triageResult());
    emitAction('file_open');
    await vi.advanceTimersByTimeAsync(100);

    // Second nudge should be delivered
    expect(mockDeliverNudge).toHaveBeenCalledTimes(2);
  });

  // ── 3. Low Confidence Suppression ────────────────────────────────────────

  it('suppresses nudge when confidence is below threshold', async () => {
    observer = new Observer(defaultOptions({ confidenceThreshold: 0.7 }));
    observer.start();

    // Triage returns should_nudge=true but low confidence
    mockRunTriage.mockResolvedValue(triageResult({ should_nudge: true, confidence: 0.5 }));

    emitAction('file_open');
    await vi.advanceTimersByTimeAsync(100);

    // Triage was called
    expect(mockRunTriage).toHaveBeenCalledTimes(1);

    // But nudge was NOT delivered
    expect(mockDeliverNudge).not.toHaveBeenCalled();

    // Verify nudge_suppressed was logged with reason "low_confidence"
    const suppressionCalls = mockLogAction.mock.calls.filter(
      (call: unknown[]) => call[2] === 'nudge_suppressed',
    );
    expect(suppressionCalls.length).toBeGreaterThanOrEqual(1);

    const suppressionData = suppressionCalls[0]![3] as { reason: string };
    expect(suppressionData.reason).toBe('low_confidence');
  });

  // ── 4. Confidence Threshold Met ──────────────────────────────────────────

  it('delivers nudge when confidence is exactly at threshold', async () => {
    observer = new Observer(defaultOptions({ confidenceThreshold: 0.7 }));
    observer.start();

    // Triage returns confidence exactly at threshold (0.7 >= 0.7)
    mockRunTriage.mockResolvedValue(triageResult({ should_nudge: true, confidence: 0.7 }));

    emitAction('file_open');
    await vi.advanceTimersByTimeAsync(100);

    // Nudge should be delivered (threshold is inclusive)
    expect(mockRunTriage).toHaveBeenCalledTimes(1);
    expect(mockDeliverNudge).toHaveBeenCalledTimes(1);
  });

  // ── 5. should_nudge False ────────────────────────────────────────────────

  it('does not send nudge when triage returns should_nudge=false', async () => {
    observer = new Observer(defaultOptions());
    observer.start();

    // Triage says no nudge needed
    mockRunTriage.mockResolvedValue(triageResult({ should_nudge: false, confidence: 0.9 }));

    emitAction('file_open');
    await vi.advanceTimersByTimeAsync(100);

    // Triage was called
    expect(mockRunTriage).toHaveBeenCalledTimes(1);

    // No nudge delivered (and not "suppressed" — just not needed)
    expect(mockDeliverNudge).not.toHaveBeenCalled();

    // No nudge_suppressed should be logged — it is simply ignored
    const suppressionCalls = mockLogAction.mock.calls.filter(
      (call: unknown[]) => call[2] === 'nudge_suppressed',
    );
    expect(suppressionCalls).toHaveLength(0);
  });

  // ── 6. Flow State Detection ──────────────────────────────────────────────

  it('skips triage entirely when flow state is detected', async () => {
    observer = new Observer(defaultOptions({ flowStateThreshold: 10, flowStateWindowMs: 60_000 }));
    observer.start();

    // Emit 11 user-initiated actions rapidly (exceeds threshold of 10)
    for (let i = 0; i < 11; i++) {
      emitAction('file_open');
      await vi.advanceTimersByTimeAsync(10);
    }

    // Reset mocks to track only calls after flow state is established
    mockRunTriage.mockClear();
    mockDeliverNudge.mockClear();

    // Emit one more action — should be in flow state now
    emitAction('file_open');
    await vi.advanceTimersByTimeAsync(100);

    // Triage should NOT have been called — flow state skips it entirely
    expect(mockRunTriage).not.toHaveBeenCalled();
    expect(mockDeliverNudge).not.toHaveBeenCalled();
  });

  // ── 7. Flow State Ignores System Events ──────────────────────────────────

  it('does not count system events toward flow state threshold', async () => {
    observer = new Observer(defaultOptions({ flowStateThreshold: 10, flowStateWindowMs: 60_000 }));
    observer.start();

    // Emit 11 system events — these should NOT count toward flow state
    for (let i = 0; i < 11; i++) {
      emitAction('mcp_tool_call');
      await vi.advanceTimersByTimeAsync(10);
    }

    mockRunTriage.mockClear();

    // Now emit a user-initiated action — triage SHOULD fire
    // because system events do not count toward the flow state threshold
    mockRunTriage.mockResolvedValue(triageResult());
    emitAction('file_open');
    await vi.advanceTimersByTimeAsync(100);

    expect(mockRunTriage).toHaveBeenCalled();
  });

  // ── 8. Flow State Window Expiry ──────────────────────────────────────────

  it('resumes triage after flow state window expires', async () => {
    observer = new Observer(defaultOptions({ flowStateThreshold: 10, flowStateWindowMs: 60_000 }));
    observer.start();

    // Emit 11 user-initiated actions to enter flow state
    for (let i = 0; i < 11; i++) {
      emitAction('file_open');
      await vi.advanceTimersByTimeAsync(10);
    }

    // Advance time past the 60-second window so all actions expire
    await vi.advanceTimersByTimeAsync(61_000);

    mockRunTriage.mockClear();
    mockRunTriage.mockResolvedValue(triageResult());

    // Emit a triage-eligible action after window expiry — triage should fire
    emitAction('file_open');
    await vi.advanceTimersByTimeAsync(100);

    expect(mockRunTriage).toHaveBeenCalled();
  });

  // ── 9. Mute Suppression ──────────────────────────────────────────────────

  it('does not call triage when observer is muted', async () => {
    observer = new Observer(defaultOptions());
    observer.start();

    // Mute the observer
    observer.setMuted(true);
    expect(observer.isMuted()).toBe(true);

    // Emit an action that would normally trigger triage
    emitAction('file_open');
    await vi.advanceTimersByTimeAsync(100);

    // Triage should NOT have been called
    expect(mockRunTriage).not.toHaveBeenCalled();
    expect(mockDeliverNudge).not.toHaveBeenCalled();
  });

  // ── 10. Unmute Resumes Triage ────────────────────────────────────────────

  it('resumes triage after observer is unmuted', async () => {
    observer = new Observer(defaultOptions());
    observer.start();

    // Mute, then unmute
    observer.setMuted(true);
    observer.setMuted(false);
    expect(observer.isMuted()).toBe(false);

    mockRunTriage.mockResolvedValue(triageResult());

    // Emit an action — triage should now fire
    emitAction('file_open');
    await vi.advanceTimersByTimeAsync(100);

    expect(mockRunTriage).toHaveBeenCalled();
  });

  // ── 11. Broadcast Status on Mute Change ──────────────────────────────────

  it('broadcasts observer status when muted state changes', () => {
    observer = new Observer(defaultOptions());
    observer.start();

    // Muting should broadcast { active: true, muted: true }
    observer.setMuted(true);

    expect(mockBroadcastStatus).toHaveBeenCalledWith(true, true);

    // Unmuting should broadcast { active: true, muted: false }
    mockBroadcastStatus.mockClear();
    observer.setMuted(false);

    expect(mockBroadcastStatus).toHaveBeenCalledWith(true, false);
  });

  // ── 12. nudge_suppressed Logged with Correct Reason ──────────────────────

  it('logs nudge_suppressed action with correct suppression reason', async () => {
    observer = new Observer(defaultOptions({ cooldownMs: 120_000, confidenceThreshold: 0.7 }));
    observer.start();

    // --- First: deliver a nudge to start the cooldown ---
    mockRunTriage.mockResolvedValue(triageResult({ confidence: 0.9 }));
    emitAction('file_open');
    await vi.advanceTimersByTimeAsync(100);

    expect(mockDeliverNudge).toHaveBeenCalledTimes(1);

    // --- Second: trigger a cooldown suppression ---
    mockRunTriage.mockResolvedValue(triageResult({ confidence: 0.9 }));
    emitAction('file_open');
    await vi.advanceTimersByTimeAsync(100);

    // Find cooldown suppression log entry
    const cooldownCalls = mockLogAction.mock.calls.filter(
      (call: unknown[]) =>
        call[2] === 'nudge_suppressed' && (call[3] as { reason: string }).reason === 'cooldown',
    );
    expect(cooldownCalls.length).toBeGreaterThanOrEqual(1);

    // Verify the logAction call signature: logAction(db, sessionId, 'nudge_suppressed', { reason })
    const cooldownCall = cooldownCalls[0]!;
    expect(cooldownCall[1]).toBe(SESSION_ID);
    expect(cooldownCall[2]).toBe('nudge_suppressed');
    expect(cooldownCall[3]).toEqual(expect.objectContaining({ reason: 'cooldown' }));

    // --- Third: advance past cooldown and test low_confidence suppression ---
    await vi.advanceTimersByTimeAsync(121_000);

    mockRunTriage.mockResolvedValue(triageResult({ should_nudge: true, confidence: 0.5 }));
    emitAction('phase_completed');
    await vi.advanceTimersByTimeAsync(100);

    // Find low_confidence suppression log entry
    const lowConfidenceCalls = mockLogAction.mock.calls.filter(
      (call: unknown[]) =>
        call[2] === 'nudge_suppressed' &&
        (call[3] as { reason: string }).reason === 'low_confidence',
    );
    expect(lowConfidenceCalls.length).toBeGreaterThanOrEqual(1);

    const lowConfCall = lowConfidenceCalls[0]!;
    expect(lowConfCall[1]).toBe(SESSION_ID);
    expect(lowConfCall[2]).toBe('nudge_suppressed');
    expect(lowConfCall[3]).toEqual(expect.objectContaining({ reason: 'low_confidence' }));
  });

  // ── Edge Cases ───────────────────────────────────────────────────────────

  it('ignores actions from other sessions', async () => {
    observer = new Observer(defaultOptions({ sessionId: SESSION_ID }));
    observer.start();

    // Emit action for a DIFFERENT session
    emitAction('file_open', 999);
    await vi.advanceTimersByTimeAsync(100);

    // Observer should not trigger triage for unrelated sessions
    expect(mockRunTriage).not.toHaveBeenCalled();
  });

  it('does not trigger triage after stop() is called', async () => {
    observer = new Observer(defaultOptions());
    observer.start();
    observer.stop();

    emitAction('file_open');
    await vi.advanceTimersByTimeAsync(100);

    expect(mockRunTriage).not.toHaveBeenCalled();
  });

  it('counts all user-initiated action types toward flow state', async () => {
    observer = new Observer(defaultOptions({ flowStateThreshold: 10, flowStateWindowMs: 60_000 }));
    observer.start();

    // Mix of user-initiated action types (all should count)
    const userActions: ActionType[] = [
      'buffer_summary',
      'buffer_significant_change',
      'file_open',
      'file_save',
      'editor_tab_switch',
      'file_open',
      'file_save',
      'buffer_summary',
      'file_open',
      'editor_tab_switch',
      'file_open', // 11th action
    ];

    for (const action of userActions) {
      emitAction(action);
      await vi.advanceTimersByTimeAsync(10);
    }

    // Reset mock to track only after flow state is established
    mockRunTriage.mockClear();

    // Next action should be flow-state suppressed
    emitAction('file_open');
    await vi.advanceTimersByTimeAsync(100);

    expect(mockRunTriage).not.toHaveBeenCalled();
  });

  it('does not count non-user system events toward flow state', async () => {
    observer = new Observer(defaultOptions({ flowStateThreshold: 10, flowStateWindowMs: 60_000 }));
    observer.start();

    // Mix system events that should NOT count
    const systemActions: ActionType[] = [
      'mcp_tool_call',
      'decorations_applied',
      'coaching_message',
      'mcp_tool_call',
      'decorations_applied',
      'coaching_message',
      'mcp_tool_call',
      'decorations_applied',
      'coaching_message',
      'mcp_tool_call',
      'decorations_applied', // 11 system events
    ];

    for (const action of systemActions) {
      emitAction(action);
      await vi.advanceTimersByTimeAsync(10);
    }

    mockRunTriage.mockClear();
    mockRunTriage.mockResolvedValue(triageResult());

    // Triage-eligible action after 11 system events — triage SHOULD fire (no flow state)
    emitAction('file_open');
    await vi.advanceTimersByTimeAsync(100);

    expect(mockRunTriage).toHaveBeenCalled();
  });
});
