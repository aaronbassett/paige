/**
 * Unit tests for the EditorToast coaching toast system.
 *
 * Covers:
 *   - showCoachingToast creates toasts with correct messageId and styles
 *   - dismissCoachingToast removes a specific toast
 *   - dismissAllCoachingToasts clears all toasts
 *   - Border colors match CoachingMessageType values
 *   - CoachingToastContainer renders without errors
 *   - onClose callback fires with messageId
 */

import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures these are available when vi.mock factory runs
// ---------------------------------------------------------------------------

const { mockToast, mockDismiss } = vi.hoisted(() => {
  const mockDismiss = vi.fn();
  const mockToast = Object.assign(vi.fn(), { dismiss: mockDismiss });
  return { mockToast, mockDismiss };
});

vi.mock('react-toastify', () => ({
  toast: mockToast,
  ToastContainer: (props: Record<string, unknown>) => (
    <div data-testid="toast-container" data-props={JSON.stringify(props)} />
  ),
}));

vi.mock('react-toastify/dist/ReactToastify.css', () => ({}));

// Import after mocks are in place
import {
  showCoachingToast,
  dismissCoachingToast,
  dismissAllCoachingToasts,
  CoachingToastContainer,
} from '../../../../renderer/src/components/Hints/EditorToast';

import type { CoachingMessageType } from '../../../../shared/types/entities';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the `style` option from the most recent toast() call. */
function getLastToastStyle(): React.CSSProperties {
  const lastCall = mockToast.mock.calls.at(-1);
  // toast(content, options) — options is the second argument
  return (lastCall?.[1] as { style: React.CSSProperties })?.style;
}

/** Extract the `toastId` option from the most recent toast() call. */
function getLastToastId(): string {
  const lastCall = mockToast.mock.calls.at(-1);
  return (lastCall?.[1] as { toastId: string })?.toastId;
}

/** Extract the `onClose` callback from the most recent toast() call. */
function getLastOnClose(): (() => void) | undefined {
  const lastCall = mockToast.mock.calls.at(-1);
  return (lastCall?.[1] as { onClose?: () => void })?.onClose;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EditorToast', () => {
  beforeEach(() => {
    mockToast.mockClear();
    mockDismiss.mockClear();
  });

  // -------------------------------------------------------------------------
  // showCoachingToast
  // -------------------------------------------------------------------------

  describe('showCoachingToast', () => {
    it('calls toast() with the provided messageId as toastId', () => {
      showCoachingToast({
        messageId: 'msg-001',
        message: 'Check your imports.',
        type: 'hint',
      });

      expect(mockToast).toHaveBeenCalledTimes(1);
      expect(getLastToastId()).toBe('msg-001');
    });

    it('passes autoClose: false for persistent toasts', () => {
      showCoachingToast({
        messageId: 'msg-002',
        message: 'Good progress!',
        type: 'success',
      });

      const options = mockToast.mock.calls.at(-1)?.[1] as Record<string, unknown>;
      expect(options.autoClose).toBe(false);
    });

    it('passes closeOnClick: false so toasts require the close button', () => {
      showCoachingToast({
        messageId: 'msg-003',
        message: 'Try a different approach.',
        type: 'info',
      });

      const options = mockToast.mock.calls.at(-1)?.[1] as Record<string, unknown>;
      expect(options.closeOnClick).toBe(false);
    });

    it('sets position to top-right', () => {
      showCoachingToast({
        messageId: 'msg-004',
        message: 'Watch out for edge cases.',
        type: 'warning',
      });

      const options = mockToast.mock.calls.at(-1)?.[1] as Record<string, unknown>;
      expect(options.position).toBe('top-right');
    });

    it('invokes onClose callback with messageId when toast closes', () => {
      const onClose = vi.fn();

      showCoachingToast({
        messageId: 'msg-close-test',
        message: 'Some hint.',
        type: 'hint',
        onClose,
      });

      const onCloseHandler = getLastOnClose();
      expect(onCloseHandler).toBeDefined();
      onCloseHandler?.();
      expect(onClose).toHaveBeenCalledWith('msg-close-test');
    });

    it('does not throw when onClose is not provided', () => {
      showCoachingToast({
        messageId: 'msg-no-close',
        message: 'No callback.',
        type: 'info',
      });

      const onCloseHandler = getLastOnClose();
      expect(() => onCloseHandler?.()).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Border colors per type
  // -------------------------------------------------------------------------

  describe('border colors', () => {
    const expectedColors: Record<CoachingMessageType, string> = {
      hint: '#d97757',
      info: '#6b9fcc',
      success: '#7ab88f',
      warning: '#d4a857',
    };

    for (const [type, color] of Object.entries(expectedColors)) {
      it(`applies ${color} left border for type "${type}"`, () => {
        showCoachingToast({
          messageId: `msg-${type}`,
          message: `${type} message`,
          type: type as CoachingMessageType,
        });

        const style = getLastToastStyle();
        expect(style.borderLeft).toBe(`3px solid ${color}`);
      });
    }

    it('uses warm dark background (#252523) for all types', () => {
      showCoachingToast({
        messageId: 'msg-bg',
        message: 'Check background.',
        type: 'hint',
      });

      const style = getLastToastStyle();
      expect(style.background).toBe('#252523');
    });

    it('uses parchment text color (#e8e4d9)', () => {
      showCoachingToast({
        messageId: 'msg-color',
        message: 'Check text color.',
        type: 'info',
      });

      const style = getLastToastStyle();
      expect(style.color).toBe('#e8e4d9');
    });

    it('uses monospace font family', () => {
      showCoachingToast({
        messageId: 'msg-font',
        message: 'Check font.',
        type: 'success',
      });

      const style = getLastToastStyle();
      expect(style.fontFamily).toContain('JetBrains Mono');
      expect(style.fontFamily).toContain('monospace');
    });

    it('sets font size to 13px', () => {
      showCoachingToast({
        messageId: 'msg-size',
        message: 'Check size.',
        type: 'warning',
      });

      const style = getLastToastStyle();
      expect(style.fontSize).toBe('13px');
    });

    it('sets border radius to 8px', () => {
      showCoachingToast({
        messageId: 'msg-radius',
        message: 'Check radius.',
        type: 'hint',
      });

      const style = getLastToastStyle();
      expect(style.borderRadius).toBe('8px');
    });

    it('constrains max width to 320px', () => {
      showCoachingToast({
        messageId: 'msg-width',
        message: 'Check width.',
        type: 'info',
      });

      const style = getLastToastStyle();
      expect(style.maxWidth).toBe('320px');
    });
  });

  // -------------------------------------------------------------------------
  // dismissCoachingToast
  // -------------------------------------------------------------------------

  describe('dismissCoachingToast', () => {
    it('calls toast.dismiss with the provided messageId', () => {
      dismissCoachingToast('msg-dismiss');

      expect(mockDismiss).toHaveBeenCalledTimes(1);
      expect(mockDismiss).toHaveBeenCalledWith('msg-dismiss');
    });
  });

  // -------------------------------------------------------------------------
  // dismissAllCoachingToasts
  // -------------------------------------------------------------------------

  describe('dismissAllCoachingToasts', () => {
    it('calls toast.dismiss with no arguments to clear all', () => {
      dismissAllCoachingToasts();

      expect(mockDismiss).toHaveBeenCalledTimes(1);
      expect(mockDismiss).toHaveBeenCalledWith();
    });
  });

  // -------------------------------------------------------------------------
  // CoachingToastContainer
  // -------------------------------------------------------------------------

  describe('CoachingToastContainer', () => {
    it('renders without errors', () => {
      const { container } = render(<CoachingToastContainer />);
      expect(container).toBeTruthy();
    });

    it('renders a ToastContainer element', () => {
      const { getByTestId } = render(<CoachingToastContainer />);
      expect(getByTestId('toast-container')).toBeInTheDocument();
    });

    it('configures ToastContainer with position top-right', () => {
      const { getByTestId } = render(<CoachingToastContainer />);
      const el = getByTestId('toast-container');
      const props = JSON.parse(el.getAttribute('data-props') ?? '{}');
      expect(props.position).toBe('top-right');
    });

    it('configures ToastContainer with newestOnTop', () => {
      const { getByTestId } = render(<CoachingToastContainer />);
      const el = getByTestId('toast-container');
      const props = JSON.parse(el.getAttribute('data-props') ?? '{}');
      expect(props.newestOnTop).toBe(true);
    });

    it('limits visible toasts to 5', () => {
      const { getByTestId } = render(<CoachingToastContainer />);
      const el = getByTestId('toast-container');
      const props = JSON.parse(el.getAttribute('data-props') ?? '{}');
      expect(props.limit).toBe(5);
    });

    it('hides the progress bar', () => {
      const { getByTestId } = render(<CoachingToastContainer />);
      const el = getByTestId('toast-container');
      const props = JSON.parse(el.getAttribute('data-props') ?? '{}');
      expect(props.hideProgressBar).toBe(true);
    });
  });
});
