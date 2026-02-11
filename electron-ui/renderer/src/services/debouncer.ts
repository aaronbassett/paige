/**
 * Debounce utilities for the Paige Electron UI.
 *
 * Provides a generic debounce function with optional max-wait support,
 * plus pre-configured timing constants for common UI operations.
 *
 * Max-wait ensures that even under continuous rapid invocation, the
 * function will fire at least once within the max-wait window. This
 * prevents data from going stale when the user types continuously.
 */

// ---------------------------------------------------------------------------
// Pre-configured debounce timing constants
// ---------------------------------------------------------------------------

/** Buffer update debounce delay (ms). Applied to editor content changes. */
export const DEBOUNCE_BUFFER_UPDATE = 300;

/** Maximum wait before a buffer update must fire, even under continuous typing (ms). */
export const DEBOUNCE_BUFFER_MAX_WAIT = 5000;

/** Editor scroll event debounce delay (ms). */
export const DEBOUNCE_EDITOR_SCROLL = 200;

/** Hint level change debounce delay (ms). Prevents rapid hint cycling. */
export const DEBOUNCE_HINT_LEVEL = 200;

/** Idle detection threshold (ms). User is considered idle after this duration. */
export const DEBOUNCE_IDLE_START = 5000;

// ---------------------------------------------------------------------------
// Debounce function
// ---------------------------------------------------------------------------

/** Return type of debounce — the debounced function plus a cancel method. */
export interface DebouncedFunction<T extends unknown[]> {
  (...args: T): void;
  /** Cancel any pending invocation. */
  cancel: () => void;
  /** Immediately invoke the pending function if one is scheduled. */
  flush: () => void;
}

/**
 * Create a debounced version of `fn` that delays invocation until `ms`
 * milliseconds have elapsed since the last call.
 *
 * @param fn - The function to debounce.
 * @param ms - Delay in milliseconds after the last invocation.
 * @param maxWait - Optional maximum delay (ms). When set, the function
 *   will fire at most `maxWait` ms after the first invocation in a burst,
 *   even if new calls keep arriving.
 *
 * @example
 * ```ts
 * const debouncedSave = debounce(
 *   (content: string) => wsClient.send('buffer:update', { content }),
 *   DEBOUNCE_BUFFER_UPDATE,
 *   DEBOUNCE_BUFFER_MAX_WAIT,
 * );
 *
 * // In editor onChange:
 * debouncedSave(newContent);
 *
 * // On unmount:
 * debouncedSave.cancel();
 * ```
 */
export function debounce<T extends unknown[]>(
  fn: (...args: T) => void,
  ms: number,
  maxWait?: number
): DebouncedFunction<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let maxTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: T | null = null;

  const clearTimers = (): void => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    if (maxTimeout !== null) {
      clearTimeout(maxTimeout);
      maxTimeout = null;
    }
  };

  const invoke = (): void => {
    clearTimers();
    if (lastArgs !== null) {
      const args = lastArgs;
      lastArgs = null;
      fn(...args);
    }
  };

  const debounced = (...args: T): void => {
    lastArgs = args;

    // Reset the trailing-edge timer on every call
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(invoke, ms);

    // Start the max-wait timer on the first call in a burst
    if (maxWait !== undefined && maxTimeout === null) {
      maxTimeout = setTimeout(invoke, maxWait);
    }
  };

  debounced.cancel = (): void => {
    clearTimers();
    lastArgs = null;
  };

  debounced.flush = (): void => {
    if (lastArgs !== null) {
      invoke();
    }
  };

  return debounced;
}
