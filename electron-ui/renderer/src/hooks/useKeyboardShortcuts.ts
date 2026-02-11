/**
 * useKeyboardShortcuts -- Centralized hint-level keyboard shortcut handling.
 *
 * Registers a single `keydown` listener on `window` for hint-level shortcuts:
 *
 *  - **Cmd+Shift+H** — Cycle hint level (nudge -> guide -> solution -> nudge)
 *  - **Cmd+Shift+[** — Decrease hint level
 *  - **Cmd+Shift+]** — Increase hint level
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

      if (!isMod || !e.shiftKey) {
        return;
      }

      const key = e.key.toLowerCase();

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
