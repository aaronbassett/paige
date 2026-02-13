/**
 * React hook for tracking planning agent progress in the Paige Electron UI.
 *
 * Subscribes to five planning-related WebSocket messages and maintains
 * the full lifecycle state: idle -> loading -> complete | error.
 *
 * During the loading phase, the hook accumulates tool-use log entries
 * (capped at 50) and tracks the current planning phase and progress
 * percentage. When planning completes, the full plan payload is stored
 * in `result` for the UI to transition to the IDE view.
 *
 * Usage:
 * ```tsx
 * function PlanningScreen() {
 *   const { status, issueTitle, currentPhase, progress, logs, result, error } =
 *     usePlanningProgress();
 *
 *   if (status === 'idle') return <WaitingForSession />;
 *   if (status === 'loading') return <LoadingScreen phase={currentPhase} logs={logs} />;
 *   if (status === 'error') return <ErrorScreen message={error} />;
 *   if (status === 'complete') return <IDELayout plan={result} />;
 * }
 * ```
 */

import { useState, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import type {
  PlanningPhase,
  PlanningCompletePayload,
} from '@shared/types/websocket-messages';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Lifecycle status of the planning flow. */
export type PlanningStatus = 'idle' | 'loading' | 'complete' | 'error';

/** A single log entry from the planning agent's tool use. */
export interface LogEntry {
  message: string;
  toolName?: string;
  filePath?: string;
  timestamp: number;
}

/** Full state returned by the usePlanningProgress hook. */
export interface PlanningProgressState {
  /** Current lifecycle status. */
  status: PlanningStatus;
  /** Title of the GitHub issue being planned. */
  issueTitle: string | null;
  /** Current planning phase (fetching, exploring, planning, writing_hints). */
  currentPhase: PlanningPhase | null;
  /** Progress percentage (0-100). */
  progress: number;
  /** Rolling log of tool-use entries (capped at MAX_LOG_ENTRIES). */
  logs: LogEntry[];
  /** Full plan payload once planning completes. */
  result: PlanningCompletePayload | null;
  /** Error message if planning failed. */
  error: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_LOG_ENTRIES = 50;

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function usePlanningProgress(): PlanningProgressState {
  const { on } = useWebSocket();
  const [state, setState] = useState<PlanningProgressState>({
    status: 'idle',
    issueTitle: null,
    currentPhase: null,
    progress: 0,
    logs: [],
    result: null,
    error: null,
  });

  useEffect(() => {
    const unsubs = [
      on('planning:started', (msg) => {
        const { issueTitle } = msg.payload as {
          sessionId: string;
          issueTitle: string;
        };
        setState((s) => ({ ...s, status: 'loading', issueTitle }));
      }),

      on('planning:progress', (msg) => {
        const { message, toolName, filePath } = msg.payload as {
          message: string;
          toolName?: string;
          filePath?: string;
        };
        setState((s) => ({
          ...s,
          logs: [
            ...s.logs.slice(-(MAX_LOG_ENTRIES - 1)),
            { message, toolName, filePath, timestamp: Date.now() },
          ],
        }));
      }),

      on('planning:phase_update', (msg) => {
        const { phase, progress } = msg.payload as {
          phase: PlanningPhase;
          progress: number;
        };
        setState((s) => ({ ...s, currentPhase: phase, progress }));
      }),

      on('planning:complete', (msg) => {
        const result = msg.payload as PlanningCompletePayload;
        setState((s) => ({ ...s, status: 'complete', result, progress: 100 }));
      }),

      on('planning:error', (msg) => {
        const { error } = msg.payload as {
          sessionId: string;
          error: string;
        };
        setState((s) => ({ ...s, status: 'error', error }));
      }),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, [on]);

  return state;
}
