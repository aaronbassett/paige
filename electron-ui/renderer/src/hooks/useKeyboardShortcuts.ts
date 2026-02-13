/**
 * useKeyboardShortcuts -- Centralized keyboard shortcut handling.
 *
 * Registers a single `keydown` listener on `window` for:
 *
 * **Hint-level shortcuts** (Cmd+Shift required):
 *  - **Cmd+Shift+H** — Cycle hint level (nudge -> guide -> solution -> nudge)
 *  - **Cmd+Shift+[** — Decrease hint level
 *  - **Cmd+Shift+]** — Increase hint level
 *
 * **TTS shortcuts** (Cmd, no Shift):
 *  - **Cmd+M** — Toggle TTS mute
 *  - **Cmd+.** — Skip current TTS playback
 *
 * **TTS shortcuts** (Cmd+Shift):
 *  - **Cmd+Shift+.** — Replay last TTS message
 *
 * Uses `useRef` for handler references to avoid re-registering the event
 * listener when callbacks change. The listener checks `metaKey` (Mac) or
 * `ctrlKey` (Linux/Windows) for the modifier key.
 *
 * Note: Cmd+S (save) and Cmd+W (close tab) are handled by useFileOperations.
 */

import { useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// Handler interface
// ---------------------------------------------------------------------------

export interface KeyboardShortcutHandlers {
  /** Cycle hint level forward (nudge -> guide -> solution -> nudge). */
  onCycleHintLevel?: () => void;
  /** Decrease hint level by one step. */
  onDecreaseHintLevel?: () => void;
  /** Increase hint level by one step. */
  onIncreaseHintLevel?: () => void;
  /** Toggle TTS mute. */
  onToggleMute?: () => void;
  /** Skip current TTS playback. */
  onSkipAudio?: () => void;
  /** Replay last TTS message. */
  onReplayAudio?: () => void;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

/**
 * Registers global keyboard shortcuts for hint-level manipulation.
 *
 * All matched shortcuts call `event.preventDefault()` to suppress
 * browser/Electron defaults. Handlers are stored in a ref so the
 * listener is registered once and never re-attached when callbacks change.
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers): void {
  const handlersRef = useRef<KeyboardShortcutHandlers>(handlers);

  // Keep the ref current without causing the effect to re-run.
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      if (!isMod) {
        return;
      }

      const key = e.key.toLowerCase();

      // --- TTS shortcuts (Cmd, no Shift) ---

      // Cmd+M — Toggle TTS mute
      if (!e.shiftKey && key === 'm') {
        e.preventDefault();
        handlersRef.current.onToggleMute?.();
        return;
      }

      // Cmd+. — Skip TTS playback
      if (!e.shiftKey && key === '.') {
        e.preventDefault();
        handlersRef.current.onSkipAudio?.();
        return;
      }

      // --- TTS + Hint shortcuts (Cmd+Shift) ---

      if (!e.shiftKey) return; // Remaining shortcuts all require Shift

      // Cmd+Shift+. — Replay last TTS message
      // When Shift is held, `.` may report as `>` on some keyboards.
      if (key === '.' || key === '>') {
        e.preventDefault();
        handlersRef.current.onReplayAudio?.();
        return;
      }

      // Cmd+Shift+H — Cycle hint level
      if (key === 'h') {
        e.preventDefault();
        handlersRef.current.onCycleHintLevel?.();
        return;
      }

      // Cmd+Shift+[ — Decrease hint level
      // When Shift is held, `[` may report as `{` on some keyboards.
      if (key === '[' || key === '{') {
        e.preventDefault();
        handlersRef.current.onDecreaseHintLevel?.();
        return;
      }

      // Cmd+Shift+] — Increase hint level
      // When Shift is held, `]` may report as `}` on some keyboards.
      if (key === ']' || key === '}') {
        e.preventDefault();
        handlersRef.current.onIncreaseHintLevel?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
