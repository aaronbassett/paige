/**
 * Unit tests for the CommentBalloon component.
 *
 * Covers message rendering, type-colored borders, close button interaction,
 * max-width/max-height constraints, and emphasized styling.
 *
 * @floating-ui/react is mocked to return a simple positioned div so tests
 * run without real DOM measurement.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { CoachingMessageType } from '@shared/types/entities';
import { CommentBalloon } from '../../../../renderer/src/components/Hints/CommentBalloon';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@floating-ui/react', () => ({
  useFloating: () => ({
    refs: { setReference: vi.fn(), setFloating: vi.fn() },
    floatingStyles: { position: 'absolute' as const, top: 0, left: 0 },
    context: {
      refs: { setReference: vi.fn(), setFloating: vi.fn() },
      elements: {},
    },
  }),
  offset: () => ({}),
  flip: () => ({}),
  shift: () => ({}),
  arrow: () => ({}),
  autoUpdate: vi.fn(() => vi.fn()),
  FloatingArrow: ({ ...props }: Record<string, unknown>) => (
    <div data-testid="floating-arrow" {...props} />
  ),
}));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BORDER_COLORS: Record<CoachingMessageType, string> = {
  hint: '#d97757',
  info: '#6b9fcc',
  success: '#7ab88f',
  warning: '#d4a857',
};

const MESSAGE_TYPES: CoachingMessageType[] = [
  'hint',
  'info',
  'success',
  'warning',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createReferenceElement(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommentBalloon', () => {
  let referenceElement: HTMLElement;

  beforeEach(() => {
    referenceElement = createReferenceElement();
  });

  // -------------------------------------------------------------------------
  // Message rendering
  // -------------------------------------------------------------------------

  describe('message rendering', () => {
    it('renders the message content', () => {
      const onClose = vi.fn();
      render(
        <CommentBalloon
          message="Check the loop condition on line 12"
          type="hint"
          messageId="msg-1"
          referenceElement={referenceElement}
          onClose={onClose}
        />,
      );

      expect(screen.getByTestId('balloon-message-msg-1')).toHaveTextContent(
        'Check the loop condition on line 12',
      );
    });

    it('renders the floating arrow', () => {
      const onClose = vi.fn();
      render(
        <CommentBalloon
          message="Good job!"
          type="success"
          messageId="msg-2"
          referenceElement={referenceElement}
          onClose={onClose}
        />,
      );

      expect(screen.getByTestId('floating-arrow')).toBeInTheDocument();
    });

    it('returns null when referenceElement is null', () => {
      const onClose = vi.fn();
      const { container } = render(
        <CommentBalloon
          message="Should not appear"
          type="hint"
          messageId="msg-null"
          referenceElement={null}
          onClose={onClose}
        />,
      );

      expect(container.innerHTML).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // Type-colored borders
  // -------------------------------------------------------------------------

  describe('type-colored borders', () => {
    it.each(MESSAGE_TYPES)(
      'shows correct border color for type "%s"',
      (type) => {
        const onClose = vi.fn();
        render(
          <CommentBalloon
            message={`Message of type ${type}`}
            type={type}
            messageId={`msg-${type}`}
            referenceElement={referenceElement}
            onClose={onClose}
          />,
        );

        const balloon = screen.getByTestId(`comment-balloon-msg-${type}`);
        expect(balloon.style.borderLeftColor).toBe(BORDER_COLORS[type]);
      },
    );

    it.each(MESSAGE_TYPES)(
      'has left border width of 3px for type "%s"',
      (type) => {
        const onClose = vi.fn();
        render(
          <CommentBalloon
            message={`Message of type ${type}`}
            type={type}
            messageId={`msg-border-${type}`}
            referenceElement={referenceElement}
            onClose={onClose}
          />,
        );

        const balloon = screen.getByTestId(
          `comment-balloon-msg-border-${type}`,
        );
        expect(balloon.style.borderLeftWidth).toBe('3px');
        expect(balloon.style.borderLeftStyle).toBe('solid');
      },
    );
  });

  // -------------------------------------------------------------------------
  // Close button
  // -------------------------------------------------------------------------

  describe('close button', () => {
    it('calls onClose with messageId when close button is clicked', () => {
      const onClose = vi.fn();
      render(
        <CommentBalloon
          message="Dismissable message"
          type="info"
          messageId="msg-close"
          referenceElement={referenceElement}
          onClose={onClose}
        />,
      );

      const closeButton = screen.getByTestId('close-balloon-msg-close');
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledWith('msg-close');
    });

    it('has an accessible label indicating the message type', () => {
      const onClose = vi.fn();
      render(
        <CommentBalloon
          message="Warning message"
          type="warning"
          messageId="msg-warn"
          referenceElement={referenceElement}
          onClose={onClose}
        />,
      );

      const closeButton = screen.getByLabelText('Close warning message');
      expect(closeButton).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Dimensions
  // -------------------------------------------------------------------------

  describe('dimensions', () => {
    it('has max-width of 320px', () => {
      const onClose = vi.fn();
      render(
        <CommentBalloon
          message="Constrained width"
          type="hint"
          messageId="msg-width"
          referenceElement={referenceElement}
          onClose={onClose}
        />,
      );

      const balloon = screen.getByTestId('comment-balloon-msg-width');
      expect(balloon.style.maxWidth).toBe('320px');
    });

    it('has max-height of 200px', () => {
      const onClose = vi.fn();
      render(
        <CommentBalloon
          message="Constrained height"
          type="hint"
          messageId="msg-height"
          referenceElement={referenceElement}
          onClose={onClose}
        />,
      );

      const balloon = screen.getByTestId('comment-balloon-msg-height');
      expect(balloon.style.maxHeight).toBe('200px');
    });

    it('has overflow-y auto for scrollable content', () => {
      const onClose = vi.fn();
      render(
        <CommentBalloon
          message="Scrollable content when it overflows"
          type="info"
          messageId="msg-scroll"
          referenceElement={referenceElement}
          onClose={onClose}
        />,
      );

      const balloon = screen.getByTestId('comment-balloon-msg-scroll');
      expect(balloon.style.overflowY).toBe('auto');
    });
  });

  // -------------------------------------------------------------------------
  // Emphasized state
  // -------------------------------------------------------------------------

  describe('emphasized state', () => {
    it('applies emphasized styling when emphasized prop is true', () => {
      const onClose = vi.fn();
      render(
        <CommentBalloon
          message="Focused review comment"
          type="hint"
          messageId="msg-emp"
          referenceElement={referenceElement}
          onClose={onClose}
          emphasized
        />,
      );

      const balloon = screen.getByTestId('comment-balloon-msg-emp');
      expect(balloon.getAttribute('data-emphasized')).toBe('true');
      // Emphasized state uses the type border color on top/right/bottom
      expect(balloon.style.borderTopColor).toBe(BORDER_COLORS.hint);
      expect(balloon.style.borderRightColor).toBe(BORDER_COLORS.hint);
      expect(balloon.style.borderBottomColor).toBe(BORDER_COLORS.hint);
      // Left border always uses the type color
      expect(balloon.style.borderLeftColor).toBe(BORDER_COLORS.hint);
      // Emphasized state has a glow shadow containing the border color
      expect(balloon.style.boxShadow).toContain(BORDER_COLORS.hint);
    });

    it('uses default subtle border when not emphasized', () => {
      const onClose = vi.fn();
      render(
        <CommentBalloon
          message="Normal comment"
          type="success"
          messageId="msg-normal"
          referenceElement={referenceElement}
          onClose={onClose}
        />,
      );

      const balloon = screen.getByTestId('comment-balloon-msg-normal');
      expect(balloon.getAttribute('data-emphasized')).toBe('false');
      // Non-emphasized uses the default shadow
      expect(balloon.style.boxShadow).toContain('rgba(0, 0, 0');
    });

    it('uses type-specific glow for different types when emphasized', () => {
      const onClose = vi.fn();
      render(
        <CommentBalloon
          message="Warning glow"
          type="warning"
          messageId="msg-warn-emp"
          referenceElement={referenceElement}
          onClose={onClose}
          emphasized
        />,
      );

      const balloon = screen.getByTestId('comment-balloon-msg-warn-emp');
      expect(balloon.style.borderTopColor).toBe(BORDER_COLORS.warning);
      expect(balloon.style.borderRightColor).toBe(BORDER_COLORS.warning);
      expect(balloon.style.borderBottomColor).toBe(BORDER_COLORS.warning);
      expect(balloon.style.boxShadow).toContain(BORDER_COLORS.warning);
    });
  });

  // -------------------------------------------------------------------------
  // Tooltip role
  // -------------------------------------------------------------------------

  describe('accessibility', () => {
    it('has tooltip role for screen readers', () => {
      const onClose = vi.fn();
      render(
        <CommentBalloon
          message="Accessible balloon"
          type="info"
          messageId="msg-a11y"
          referenceElement={referenceElement}
          onClose={onClose}
        />,
      );

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('exposes the message type via data-type attribute', () => {
      const onClose = vi.fn();
      render(
        <CommentBalloon
          message="Typed balloon"
          type="success"
          messageId="msg-dt"
          referenceElement={referenceElement}
          onClose={onClose}
        />,
      );

      const balloon = screen.getByTestId('comment-balloon-msg-dt');
      expect(balloon.getAttribute('data-type')).toBe('success');
    });
  });
});
