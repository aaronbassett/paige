/**
 * Unit tests for the useKeyboardShortcuts hook.
 *
 * Tests cover:
 * - Cmd+Shift+H calls onCycleHintLevel
 * - Cmd+Shift+[ calls onDecreaseHintLevel
 * - Cmd+Shift+] calls onIncreaseHintLevel
 * - Shift+{ and Shift+} alternate key values also work
 * - Ctrl modifier works (Linux/Windows)
 * - preventDefault is called for matched shortcuts
 * - Unrelated keys do not trigger callbacks
 * - Listener is cleaned up on unmount
 * - Missing (undefined) callbacks do not throw
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '../../../renderer/src/hooks/useKeyboardShortcuts';
import type { KeyboardShortcutHandlers } from '../../../renderer/src/hooks/useKeyboardShortcuts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Dispatch a keyboard event on window with the given properties. */
function pressKey(
  opts: Partial<KeyboardEventInit> & { key: string },
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...opts,
  });

  // Spy on preventDefault so we can assert it was called
  const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

  window.dispatchEvent(event);

  return Object.assign(event, { preventDefaultSpy });
}

/** Shortcut for a Meta+Shift+key combination (Mac). */
function metaShift(key: string): KeyboardEvent {
  return pressKey({ key, metaKey: true, shiftKey: true });
}

/** Shortcut for a Ctrl+Shift+key combination (Linux/Windows). */
function ctrlShift(key: string): KeyboardEvent {
  return pressKey({ key, ctrlKey: true, shiftKey: true });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useKeyboardShortcuts', () => {
  it('should call onCycleHintLevel on Cmd+Shift+H', () => {
    const handlers: KeyboardShortcutHandlers = {
      onCycleHintLevel: vi.fn(),
    };

    renderHook(() => useKeyboardShortcuts(handlers));

    metaShift('H');

    expect(handlers.onCycleHintLevel).toHaveBeenCalledTimes(1);
  });

  it('should call onCycleHintLevel on Cmd+Shift+h (lowercase)', () => {
    const handlers: KeyboardShortcutHandlers = {
      onCycleHintLevel: vi.fn(),
    };

    renderHook(() => useKeyboardShortcuts(handlers));

    metaShift('h');

    expect(handlers.onCycleHintLevel).toHaveBeenCalledTimes(1);
  });

  it('should call onDecreaseHintLevel on Cmd+Shift+[', () => {
    const handlers: KeyboardShortcutHandlers = {
      onDecreaseHintLevel: vi.fn(),
    };

    renderHook(() => useKeyboardShortcuts(handlers));

    metaShift('[');

    expect(handlers.onDecreaseHintLevel).toHaveBeenCalledTimes(1);
  });

  it('should call onDecreaseHintLevel on Cmd+Shift+{ (alternate key value)', () => {
    const handlers: KeyboardShortcutHandlers = {
      onDecreaseHintLevel: vi.fn(),
    };

    renderHook(() => useKeyboardShortcuts(handlers));

    metaShift('{');

    expect(handlers.onDecreaseHintLevel).toHaveBeenCalledTimes(1);
  });

  it('should call onIncreaseHintLevel on Cmd+Shift+]', () => {
    const handlers: KeyboardShortcutHandlers = {
      onIncreaseHintLevel: vi.fn(),
    };

    renderHook(() => useKeyboardShortcuts(handlers));

    metaShift(']');

    expect(handlers.onIncreaseHintLevel).toHaveBeenCalledTimes(1);
  });

  it('should call onIncreaseHintLevel on Cmd+Shift+} (alternate key value)', () => {
    const handlers: KeyboardShortcutHandlers = {
      onIncreaseHintLevel: vi.fn(),
    };

    renderHook(() => useKeyboardShortcuts(handlers));

    metaShift('}');

    expect(handlers.onIncreaseHintLevel).toHaveBeenCalledTimes(1);
  });

  it('should work with Ctrl modifier (Linux/Windows)', () => {
    const handlers: KeyboardShortcutHandlers = {
      onCycleHintLevel: vi.fn(),
      onDecreaseHintLevel: vi.fn(),
      onIncreaseHintLevel: vi.fn(),
    };

    renderHook(() => useKeyboardShortcuts(handlers));

    ctrlShift('H');
    ctrlShift('[');
    ctrlShift(']');

    expect(handlers.onCycleHintLevel).toHaveBeenCalledTimes(1);
    expect(handlers.onDecreaseHintLevel).toHaveBeenCalledTimes(1);
    expect(handlers.onIncreaseHintLevel).toHaveBeenCalledTimes(1);
  });

  it('should call preventDefault for matched shortcuts', () => {
    const handlers: KeyboardShortcutHandlers = {
      onCycleHintLevel: vi.fn(),
      onDecreaseHintLevel: vi.fn(),
      onIncreaseHintLevel: vi.fn(),
    };

    renderHook(() => useKeyboardShortcuts(handlers));

    const e1 = metaShift('H');
    const e2 = metaShift('[');
    const e3 = metaShift(']');

    expect((e1 as ReturnType<typeof metaShift> & { preventDefaultSpy: ReturnType<typeof vi.spyOn> }).preventDefaultSpy).toHaveBeenCalled();
    expect((e2 as ReturnType<typeof metaShift> & { preventDefaultSpy: ReturnType<typeof vi.spyOn> }).preventDefaultSpy).toHaveBeenCalled();
    expect((e3 as ReturnType<typeof metaShift> & { preventDefaultSpy: ReturnType<typeof vi.spyOn> }).preventDefaultSpy).toHaveBeenCalled();
  });

  it('should NOT trigger callbacks for unrelated keys', () => {
    const handlers: KeyboardShortcutHandlers = {
      onCycleHintLevel: vi.fn(),
      onDecreaseHintLevel: vi.fn(),
      onIncreaseHintLevel: vi.fn(),
    };

    renderHook(() => useKeyboardShortcuts(handlers));

    // Cmd+Shift+K — not a hint shortcut
    metaShift('K');
    // Cmd+S — no shift, handled by useFileOperations
    pressKey({ key: 's', metaKey: true });
    // Plain H — no modifier
    pressKey({ key: 'H' });
    // Shift+H only — no Cmd/Ctrl
    pressKey({ key: 'H', shiftKey: true });

    expect(handlers.onCycleHintLevel).not.toHaveBeenCalled();
    expect(handlers.onDecreaseHintLevel).not.toHaveBeenCalled();
    expect(handlers.onIncreaseHintLevel).not.toHaveBeenCalled();
  });

  it('should clean up the listener on unmount', () => {
    const handlers: KeyboardShortcutHandlers = {
      onCycleHintLevel: vi.fn(),
    };

    const { unmount } = renderHook(() => useKeyboardShortcuts(handlers));

    unmount();

    metaShift('H');

    expect(handlers.onCycleHintLevel).not.toHaveBeenCalled();
  });

  it('should not throw when handlers are undefined', () => {
    // All handlers omitted
    const handlers: KeyboardShortcutHandlers = {};

    renderHook(() => useKeyboardShortcuts(handlers));

    // These should not throw
    expect(() => metaShift('H')).not.toThrow();
    expect(() => metaShift('[')).not.toThrow();
    expect(() => metaShift(']')).not.toThrow();
  });

  it('should use the latest handler reference without re-registering the listener', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    const { rerender } = renderHook(
      ({ onCycleHintLevel }: KeyboardShortcutHandlers) =>
        useKeyboardShortcuts({ onCycleHintLevel }),
      { initialProps: { onCycleHintLevel: firstHandler } },
    );

    // addEventListener called once on mount
    const keydownCalls = addSpy.mock.calls.filter(
      ([eventName]) => eventName === 'keydown',
    );
    expect(keydownCalls).toHaveLength(1);

    // Rerender with a new handler
    rerender({ onCycleHintLevel: secondHandler });

    // No additional addEventListener call for keydown
    const keydownCallsAfter = addSpy.mock.calls.filter(
      ([eventName]) => eventName === 'keydown',
    );
    expect(keydownCallsAfter).toHaveLength(1);

    // No removeEventListener call (listener not re-registered)
    const removeCalls = removeSpy.mock.calls.filter(
      ([eventName]) => eventName === 'keydown',
    );
    expect(removeCalls).toHaveLength(0);

    // The new handler should be used
    metaShift('H');
    expect(firstHandler).not.toHaveBeenCalled();
    expect(secondHandler).toHaveBeenCalledTimes(1);
  });
});
