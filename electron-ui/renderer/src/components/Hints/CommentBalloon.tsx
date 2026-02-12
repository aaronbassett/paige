/**
 * CommentBalloon -- Coaching message anchored to a code location in Monaco.
 *
 * Uses @floating-ui/react for positioning with flip/shift middleware so the
 * balloon stays visible even when near viewport edges. The balloon floats to
 * the right of the anchor element by default, falling back to left/top/bottom
 * when space is constrained.
 *
 * Visual design:
 *  - Left border colored by message type (hint, info, success, warning)
 *  - Max 320px wide, 200px tall with overflow scroll
 *  - Close button (X) in the top-right corner
 *  - FloatingArrow pointing back at the anchor
 *  - Optional emphasized state with brighter border/shadow for review focus
 */

import { useState, useCallback } from 'react';
import {
  useFloating,
  offset,
  flip,
  shift,
  arrow,
  autoUpdate,
  FloatingArrow,
} from '@floating-ui/react';
import type { CoachingMessageType } from '@shared/types/entities';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommentBalloonProps {
  message: string;
  type: CoachingMessageType;
  messageId: string;
  referenceElement: HTMLElement | null;
  onClose: (messageId: string) => void;
  emphasized?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BORDER_COLORS: Record<CoachingMessageType, string> = {
  hint: '#d97757',
  info: '#6b9fcc',
  success: '#7ab88f',
  warning: '#d4a857',
};

const ARROW_SIZE = 8;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const balloonBaseStyle: React.CSSProperties = {
  maxWidth: 320,
  maxHeight: 200,
  overflowY: 'auto',
  background: 'var(--bg-surface, #252523)',
  border: '1px solid var(--border-subtle, #3a3a37)',
  borderRadius: 'var(--radius-md, 8px)',
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: 'var(--text-sm, 13px)',
  color: 'var(--text-primary, #e8e4d9)',
  padding: '10px 28px 10px 12px',
  position: 'relative',
  zIndex: 100,
  boxSizing: 'border-box',
};

const closeButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: 4,
  right: 4,
  width: 20,
  height: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary, #a5a18e)',
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: 14,
  lineHeight: 1,
  cursor: 'pointer',
  borderRadius: 4,
  padding: 0,
};

const messageStyle: React.CSSProperties = {
  margin: 0,
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommentBalloon({
  message,
  type,
  messageId,
  referenceElement,
  onClose,
  emphasized = false,
}: CommentBalloonProps): React.ReactElement | null {
  const [arrowEl, setArrowEl] = useState<SVGSVGElement | null>(null);
  const arrowCallback = useCallback((node: SVGSVGElement | null) => {
    setArrowEl(node);
  }, []);

  const [floatingEl, setFloatingEl] = useState<HTMLDivElement | null>(null);
  const floatingRefCallback = useCallback((node: HTMLDivElement | null) => {
    setFloatingEl(node);
  }, []);

  const { floatingStyles, context } = useFloating({
    placement: 'right',
    middleware: [offset(8), flip(), shift({ padding: 8 }), arrow({ element: arrowEl })],
    whileElementsMounted: autoUpdate,
    elements: {
      reference: referenceElement,
      floating: floatingEl,
    },
  });

  // Don't render if there is no reference element to anchor to
  if (!referenceElement) {
    return null;
  }

  const borderColor = BORDER_COLORS[type];

  const emphasizedShadow = `0 0 8px ${borderColor}66, 0 0 2px ${borderColor}44`;

  const baseBorderColor = emphasized ? borderColor : 'var(--border-subtle, #3a3a37)';

  const combinedStyle: React.CSSProperties = {
    ...balloonBaseStyle,
    ...floatingStyles,
    borderTopColor: baseBorderColor,
    borderRightColor: baseBorderColor,
    borderBottomColor: baseBorderColor,
    borderLeftWidth: 3,
    borderLeftStyle: 'solid',
    borderLeftColor: borderColor,
    boxShadow: emphasized ? emphasizedShadow : '0 2px 8px rgba(0, 0, 0, 0.3)',
  };

  return (
    <div
      ref={floatingRefCallback}
      style={combinedStyle}
      role="tooltip"
      data-testid={`comment-balloon-${messageId}`}
      data-type={type}
      data-emphasized={emphasized}
    >
      <FloatingArrow
        ref={arrowCallback}
        context={context}
        width={ARROW_SIZE * 2}
        height={ARROW_SIZE}
        fill="var(--bg-surface, #252523)"
        stroke={borderColor}
        strokeWidth={1}
        data-testid="floating-arrow"
      />

      <button
        type="button"
        style={closeButtonStyle}
        onClick={() => onClose(messageId)}
        aria-label={`Close ${type} message`}
        data-testid={`close-balloon-${messageId}`}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--text-primary, #e8e4d9)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-secondary, #a5a18e)';
        }}
      >
        x
      </button>

      <p style={messageStyle} data-testid={`balloon-message-${messageId}`}>
        {message}
      </p>
    </div>
  );
}
