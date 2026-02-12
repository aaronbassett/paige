// Per-session Observer class — monitors user activity, triggers triage,
// delivers nudges with suppression rules (cooldown, flow state, mute).
// Implementation for T322-T325

import { actionEvents, logAction, type ActionEventPayload } from '../logger/action-log.js';
import { getDatabase } from '../database/db.js';
import { runTriage, type TriageContext } from './triage.js';
import { deliverNudge, broadcastObserverStatus } from './nudge.js';
import type { ActionType } from '../types/domain.js';

// ── Options ──────────────────────────────────────────────────────────────────

export interface ObserverOptions {
  sessionId: number;
  cooldownMs?: number;
  flowStateThreshold?: number;
  flowStateWindowMs?: number;
  confidenceThreshold?: number;
  bufferUpdateTriggerCount?: number;
  explainRequestTriggerCount?: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Action types that ALWAYS trigger triage (every occurrence). */
const TRIAGE_ALWAYS: ReadonlySet<ActionType> = new Set(['file_open', 'phase_completed']);

/** Buffer-update action types counted toward the Nth-update trigger. */
const BUFFER_UPDATE_TYPES: ReadonlySet<ActionType> = new Set([
  'buffer_summary',
  'buffer_significant_change',
]);

/** Action types counted for flow state detection (user-initiated). */
const USER_INITIATED_ACTIONS: ReadonlySet<ActionType> = new Set([
  'buffer_summary',
  'buffer_significant_change',
  'file_open',
  'file_save',
  'editor_tab_switch',
]);

// ── Observer Class ──────────────────────────────────────────────────────────

export class Observer {
  private readonly sessionId: number;
  private readonly cooldownMs: number;
  private readonly flowStateThreshold: number;
  private readonly flowStateWindowMs: number;
  private readonly confidenceThreshold: number;
  private readonly bufferUpdateTriggerCount: number;
  private readonly explainRequestTriggerCount: number;

  private _active = false;
  private _muted = false;
  private _lastNudgeTime = 0;
  private _bufferUpdateCount = 0;
  private _explainRequestCount = 0;
  private _flowStateTimestamps: number[] = [];
  private _listener: ((payload: ActionEventPayload) => void) | null = null;

  constructor(options: ObserverOptions) {
    this.sessionId = options.sessionId;
    this.cooldownMs = options.cooldownMs ?? 120_000;
    this.flowStateThreshold = options.flowStateThreshold ?? 10;
    this.flowStateWindowMs = options.flowStateWindowMs ?? 60_000;
    this.confidenceThreshold = options.confidenceThreshold ?? 0.7;
    this.bufferUpdateTriggerCount = options.bufferUpdateTriggerCount ?? 5;
    this.explainRequestTriggerCount = options.explainRequestTriggerCount ?? 3;
  }

  start(): void {
    if (this._active) return;

    this._active = true;
    this._listener = (payload: ActionEventPayload) => {
      void this.handleAction(payload);
    };
    actionEvents.on('action', this._listener);
    broadcastObserverStatus(true, this._muted);
  }

  stop(): void {
    if (!this._active) return;

    this._active = false;
    if (this._listener !== null) {
      actionEvents.removeListener('action', this._listener);
      this._listener = null;
    }
    broadcastObserverStatus(false, this._muted);
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    broadcastObserverStatus(this._active, this._muted);
  }

  isMuted(): boolean {
    return this._muted;
  }

  isActive(): boolean {
    return this._active;
  }

  // ── Internal Event Handler ───────────────────────────────────────────────

  private async handleAction(payload: ActionEventPayload): Promise<void> {
    // Ignore actions from other sessions
    if (payload.sessionId !== this.sessionId) return;

    // Ignore if not active
    if (!this._active) return;

    const actionType = payload.actionType;
    const now = Date.now();

    // Track user-initiated actions for flow state detection
    if (USER_INITIATED_ACTIONS.has(actionType)) {
      this._flowStateTimestamps.push(now);
    }

    // If muted, don't evaluate triage
    if (this._muted) return;

    // Prune flow state timestamps outside the window
    this._flowStateTimestamps = this._flowStateTimestamps.filter(
      (t) => now - t <= this.flowStateWindowMs,
    );

    // Check flow state: skip triage if >threshold user actions in the window
    if (this._flowStateTimestamps.length > this.flowStateThreshold) {
      return;
    }

    // Determine if this action should trigger triage
    let shouldTrigger = false;

    // Always-trigger types
    if (TRIAGE_ALWAYS.has(actionType)) {
      shouldTrigger = true;
    }

    // Buffer update counter (resets at threshold)
    if (BUFFER_UPDATE_TYPES.has(actionType)) {
      this._bufferUpdateCount++;
      if (this._bufferUpdateCount >= this.bufferUpdateTriggerCount) {
        shouldTrigger = true;
        this._bufferUpdateCount = 0;
      }
    }

    // Explain request counter (resets at threshold, never resets on phase change)
    if (actionType === 'user_explain_request') {
      this._explainRequestCount++;
      if (this._explainRequestCount >= this.explainRequestTriggerCount) {
        shouldTrigger = true;
        this._explainRequestCount = 0;
      }
    }

    // Reset buffer counter on phase_completed (per spec)
    if (actionType === 'phase_completed') {
      this._bufferUpdateCount = 0;
    }

    if (!shouldTrigger) return;

    // Build triage context
    const context: TriageContext = {
      sessionId: this.sessionId,
      recentActions: [
        {
          actionType: payload.actionType,
          data: payload.data,
          createdAt: payload.createdAt,
        },
      ],
      activePhase: null,
      openFiles: [],
    };

    try {
      const result = await runTriage(context);

      // Log triage evaluation
      const db = getDatabase();
      await logAction(db as never, this.sessionId, 'observer_triage', {
        should_nudge: result.should_nudge,
        confidence: result.confidence,
        signal: result.signal,
        reasoning: result.reasoning,
      });

      // If triage says no nudge needed, we're done
      if (!result.should_nudge) {
        return;
      }

      // Check confidence threshold
      if (result.confidence < this.confidenceThreshold) {
        await logAction(db as never, this.sessionId, 'nudge_suppressed', {
          reason: 'low_confidence',
          confidence: result.confidence,
          signal: result.signal,
        });
        return;
      }

      // Check cooldown
      if (now - this._lastNudgeTime < this.cooldownMs) {
        await logAction(db as never, this.sessionId, 'nudge_suppressed', {
          reason: 'cooldown',
          confidence: result.confidence,
          signal: result.signal,
        });
        return;
      }

      // Deliver nudge
      deliverNudge({
        signal: result.signal,
        confidence: result.confidence,
        context: result.reasoning,
      });
      this._lastNudgeTime = Date.now();

      // Log successful nudge delivery
      await logAction(db as never, this.sessionId, 'nudge_sent', {
        signal: result.signal,
        confidence: result.confidence,
      });
    } catch (err: unknown) {
      // Triage failure: Observer continues operating (spec scenario 10)
      // eslint-disable-next-line no-console
      console.warn(
        '[observer] Triage evaluation failed (continuing):',
        err instanceof Error ? err.message : err,
      );
    }
  }
}
