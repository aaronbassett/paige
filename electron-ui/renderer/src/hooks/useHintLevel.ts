/**
 * React hook for managing the coaching hint level in the Paige Electron UI.
 *
 * Hint levels control the verbosity of coaching guidance:
 *   0 = No hints (autonomous mode)
 *   1 = Subtle nudges
 *   2 = Moderate guidance
 *   3 = Detailed explanations
 *
 * The hook:
 *   - Initializes from `session:start` (initialHintLevel)
 *   - Restores from `session:restore` (hintLevel)
 *   - Sends debounced `hints:level_change` messages to the backend
 *   - Provides cycle (0->1->2->3->0) and increase/decrease functions
 *
 * Usage:
 * ```tsx
 * function CoachingSidebar() {
 *   const { hintLevel, cycleHintLevel, increaseHintLevel } = useHintLevel();
 *
 *   return (
 *     <button onClick={cycleHintLevel}>
 *       Hint Level: {hintLevel}
 *     </button>
 *   );
 * }
 * ```
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import type { HintLevel } from '@shared/types/entities';
import type {
  WebSocketMessage,
  SessionStartMessage,
  SessionRestoreMessage,
} from '@shared/types/websocket-messages';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Debounce delay (ms) before sending hint level change to the backend. */
const DEBOUNCE_HINT_LEVEL_MS = 200;

/** Minimum hint level. */
const MIN_HINT_LEVEL: HintLevel = 0;

/** Maximum hint level. */
const MAX_HINT_LEVEL: HintLevel = 3;

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseHintLevelReturn {
  /** Current hint level (0-3). */
  hintLevel: HintLevel;
  /** Set hint level directly (clamped to 0-3). Updates UI immediately, debounces WebSocket send. */
  setHintLevel: (level: HintLevel) => void;
  /** Cycle through levels: 0 -> 1 -> 2 -> 3 -> 0. */
  cycleHintLevel: () => void;
  /** Increase hint level by 1, clamped at 3. */
  increaseHintLevel: () => void;
  /** Decrease hint level by 1, clamped at 0. */
  decreaseHintLevel: () => void;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useHintLevel(): UseHintLevelReturn {
  const { send, on } = useWebSocket();
  const [hintLevel, setHintLevelState] = useState<HintLevel>(MIN_HINT_LEVEL);

  /** Ref for the debounce timeout so it can be cleared on subsequent calls and on cleanup. */
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -------------------------------------------------------------------------
  // Debounced WebSocket sender
  // -------------------------------------------------------------------------

  /**
   * Send the hint level change to the backend after a 200ms debounce.
   * Updates local state immediately for responsive UI.
   */
  const sendDebouncedLevelChange = useCallback(
    (level: HintLevel) => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void send('hints:level_change', { level });
      }, DEBOUNCE_HINT_LEVEL_MS);
    },
    [send],
  );

  // -------------------------------------------------------------------------
  // Cleanup debounce timer on unmount
  // -------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // -------------------------------------------------------------------------
  // WebSocket handlers: session:start, session:restore
  // -------------------------------------------------------------------------

  useEffect(() => {
    const unsubStart = on('session:start', (msg: WebSocketMessage) => {
      const { payload } = msg as SessionStartMessage;
      setHintLevelState(payload.initialHintLevel);
    });

    const unsubRestore = on('session:restore', (msg: WebSocketMessage) => {
      const { payload } = msg as SessionRestoreMessage;
      setHintLevelState(payload.hintLevel);
    });

    return () => {
      unsubStart();
      unsubRestore();
    };
  }, [on]);

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  const setHintLevel = useCallback(
    (level: HintLevel) => {
      setHintLevelState(level);
      sendDebouncedLevelChange(level);
    },
    [sendDebouncedLevelChange],
  );

  const cycleHintLevel = useCallback(() => {
    setHintLevelState((current) => {
      const next = ((current + 1) % 4) as HintLevel;
      sendDebouncedLevelChange(next);
      return next;
    });
  }, [sendDebouncedLevelChange]);

  const increaseHintLevel = useCallback(() => {
    setHintLevelState((current) => {
      const next = Math.min(current + 1, MAX_HINT_LEVEL) as HintLevel;
      if (next !== current) {
        sendDebouncedLevelChange(next);
      }
      return next;
    });
  }, [sendDebouncedLevelChange]);

  const decreaseHintLevel = useCallback(() => {
    setHintLevelState((current) => {
      const next = Math.max(current - 1, MIN_HINT_LEVEL) as HintLevel;
      if (next !== current) {
        sendDebouncedLevelChange(next);
      }
      return next;
    });
  }, [sendDebouncedLevelChange]);

  return {
    hintLevel,
    setHintLevel,
    cycleHintLevel,
    increaseHintLevel,
    decreaseHintLevel,
  };
}
