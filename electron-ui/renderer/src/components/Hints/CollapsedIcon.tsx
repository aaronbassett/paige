/**
 * CollapsedIcon -- Small circular icon representing a collapsed coaching message.
 *
 * Displayed at hint levels 0-1 for coaching source messages. Renders as a 20px
 * circle with a speech bubble SVG icon, positioned via @floating-ui/react at the
 * anchor point. Clicking expands the message into a full CommentBalloon.
 *
 * The icon has a gentle CSS pulse animation (scale + opacity) to draw attention
 * without being distracting. Background color varies by message type.
 */

import { useCallback, useEffect } from 'react';
import { useFloating, offset, flip, shift, autoUpdate } from '@floating-ui/react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CollapsedIconProps {
  messageId: string;
  type: 'hint' | 'info' | 'success' | 'warning';
  referenceElement: HTMLElement | null;
  onExpand: (messageId: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Unique ID for the injected keyframes style element. */
const STYLE_ID = 'collapsed-icon-keyframes';

/** CSS keyframes for the gentle pulse animation on the collapsed icon. */
const PULSE_KEYFRAMES = `
@keyframes collapsed-icon-pulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.1); opacity: 1; }
}
`;

/** Background color (at 60% opacity via rgba) for each message type. */
const TYPE_COLORS: Record<CollapsedIconProps['type'], string> = {
  hint: 'rgba(217, 119, 87, 0.6)',
  info: 'rgba(107, 159, 204, 0.6)',
  success: 'rgba(122, 184, 143, 0.6)',
  warning: 'rgba(212, 168, 87, 0.6)',
};

// ---------------------------------------------------------------------------
// Keyframes injection
// ---------------------------------------------------------------------------

/**
 * Injects the pulse keyframes into the document head once. Subsequent
 * calls are no-ops because we check for the style element by ID.
 */
function ensureKeyframes(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = PULSE_KEYFRAMES;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const iconContainerStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  border: 'none',
  padding: 0,
  animation: 'collapsed-icon-pulse 2s ease-in-out infinite',
  zIndex: 10,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CollapsedIcon({
  messageId,
  type,
  referenceElement,
  onExpand,
}: CollapsedIconProps): React.ReactElement | null {
  ensureKeyframes();

  const { refs, floatingStyles } = useFloating({
    placement: 'right-start',
    middleware: [offset(4), flip(), shift({ padding: 4 })],
    whileElementsMounted: autoUpdate,
  });

  // Attach the reference element when it changes
  useEffect(() => {
    if (referenceElement) {
      refs.setReference(referenceElement);
    }
  }, [referenceElement, refs]);

  // Stable callback ref for the floating element to avoid accessing refs during render
  const floatingRef = useCallback(
    (node: HTMLDivElement | null) => {
      refs.setFloating(node);
    },
    [refs]
  );

  function handleClick(): void {
    onExpand(messageId);
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onExpand(messageId);
    }
  }

  return (
    <div
      ref={floatingRef}
      style={{
        ...floatingStyles,
        ...iconContainerStyle,
        background: TYPE_COLORS[type],
      }}
      role="button"
      tabIndex={0}
      aria-label={`Expand ${type} message`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-testid="collapsed-icon"
      data-message-id={messageId}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        data-testid="collapsed-icon-svg"
      >
        <path
          d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"
          fill="white"
        />
      </svg>
    </div>
  );
}
