/**
 * EditorToast — unanchored coaching messages as toast notifications.
 *
 * Provides a utility API for showing, dismissing, and managing coaching toasts
 * using react-toastify. Toasts appear in the top-right corner, stacked with the
 * newest on top, and persist until explicitly closed by the user.
 *
 * Each toast has a type-colored left border matching the coaching message type:
 *   - hint:    #d97757 (terracotta)
 *   - info:    #6b9fcc (blue)
 *   - success: #7ab88f (green)
 *   - warning: #d4a857 (amber)
 *
 * The visual styling matches CommentBalloon for a consistent warm dark theme.
 * Toasts always show full content regardless of the current hint level.
 *
 * Exports:
 *   - showCoachingToast()     — create a toast programmatically
 *   - dismissCoachingToast()  — dismiss a specific toast by messageId
 *   - dismissAllCoachingToasts() — dismiss all coaching toasts
 *   - CoachingToastContainer  — wraps react-toastify's ToastContainer with Paige theming
 */

import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import type { CoachingMessageType } from '../../../../shared/types/entities';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Type-colored left border matching CommentBalloon color scheme. */
const BORDER_COLORS: Record<CoachingMessageType, string> = {
  hint: '#d97757',
  info: '#6b9fcc',
  success: '#7ab88f',
  warning: '#d4a857',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShowCoachingToastParams {
  /** Unique identifier for this toast (used as toastId for stable references). */
  messageId: string;
  /** The coaching message content to display. */
  message: string;
  /** Coaching message type — determines the left border color. */
  type: CoachingMessageType;
  /** Callback invoked when the toast is closed, receiving the messageId. */
  onClose?: (messageId: string) => void;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const toastContentStyle: React.CSSProperties = {
  fontSize: '13px',
  lineHeight: 1.5,
  wordBreak: 'break-word',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Show a coaching toast notification.
 *
 * Creates a persistent toast with a type-colored left border. The toast
 * remains visible until the user manually closes it.
 */
export function showCoachingToast({
  messageId,
  message,
  type,
  onClose,
}: ShowCoachingToastParams): void {
  toast(<div style={toastContentStyle}>{message}</div>, {
    toastId: messageId,
    autoClose: false,
    closeOnClick: false,
    draggable: false,
    position: 'top-right',
    style: {
      background: '#252523',
      borderLeft: `3px solid ${BORDER_COLORS[type]}`,
      color: '#e8e4d9',
      fontFamily: 'var(--font-family, "JetBrains Mono", monospace)',
      fontSize: '13px',
      borderRadius: '8px',
      maxWidth: '320px',
    },
    onClose: () => onClose?.(messageId),
  });
}

/**
 * Dismiss a specific coaching toast by its messageId.
 */
export function dismissCoachingToast(messageId: string): void {
  toast.dismiss(messageId);
}

/**
 * Dismiss all coaching toasts.
 */
export function dismissAllCoachingToasts(): void {
  toast.dismiss();
}

// ---------------------------------------------------------------------------
// Container Component
// ---------------------------------------------------------------------------

/** CSS class identifier used for custom toast container styling. */
const TOAST_STYLE_ID = 'paige-toast-overrides';

/**
 * Inject custom CSS overrides for react-toastify's default styles.
 * Called once when the container mounts.
 */
function ensureToastStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(TOAST_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = TOAST_STYLE_ID;
  style.textContent = `
    .Toastify__toast-container--top-right {
      top: 56px !important;
      right: 12px !important;
    }
    .Toastify__toast {
      min-height: auto !important;
      padding: 10px 14px !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
    }
    .Toastify__close-button {
      color: #a8a69e !important;
      opacity: 0.7 !important;
    }
    .Toastify__close-button:hover {
      color: #e8e4d9 !important;
      opacity: 1 !important;
    }
    .Toastify__progress-bar {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * CoachingToastContainer — place once in the application tree.
 *
 * Wraps react-toastify's ToastContainer with Paige-specific theming:
 * warm dark background, monospace font, and top-right positioning
 * offset below the header bar.
 */
export function CoachingToastContainer(): React.ReactElement {
  ensureToastStyles();

  return (
    <ToastContainer
      position="top-right"
      newestOnTop
      limit={5}
      closeButton
      hideProgressBar
      data-testid="coaching-toast-container"
    />
  );
}
