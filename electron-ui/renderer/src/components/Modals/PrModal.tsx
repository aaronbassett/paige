/**
 * PrModal -- Modal dialog for composing and creating a GitHub pull request.
 *
 * On open, sends `pr:suggest` via WebSocket to request an AI-generated
 * PR title and body. Populates the form when `pr:suggestion` is received.
 * On submit, sends `pr:create` with the title and body.
 *
 * Follows the IssueModal pattern for overlay/animation structure.
 * Navigates to dashboard on successful PR creation.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebSocket } from '../../hooks/useWebSocket';
import type {
  WebSocketMessage,
  PrSuggestionMessage,
  PrCreatedMessage,
  PrErrorMessage,
} from '@shared/types/websocket-messages';
import type { AppView } from '@shared/types/entities';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: AppView) => void;
}

// ---------------------------------------------------------------------------
// Skeleton keyframes (shared with CommitModal)
// ---------------------------------------------------------------------------

const SKELETON_STYLE_ID = 'paige-commit-skeleton-keyframes';

const SKELETON_KEYFRAMES = `
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}
`;

function ensureSkeletonKeyframes(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SKELETON_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = SKELETON_STYLE_ID;
  style.textContent = SKELETON_KEYFRAMES;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 20 },
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: 'var(--space-lg)',
};

const modalStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  borderRadius: '12px',
  border: '1px solid var(--border-subtle)',
  width: '100%',
  maxWidth: '600px',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  position: 'relative',
};

const headerStyle: React.CSSProperties = {
  padding: 'var(--space-md) var(--space-lg)',
  borderBottom: '1px solid var(--border-subtle)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const headerTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-base-size)',
  fontWeight: 600,
  color: 'var(--text-primary)',
  margin: 0,
};

const closeButtonStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: '6px',
  border: 'none',
  background: 'transparent',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '16px',
  fontFamily: 'var(--font-family)',
  transition: 'background 0.15s ease',
};

const bodyStyle: React.CSSProperties = {
  padding: 'var(--space-md) var(--space-lg)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-sm)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--space-xs) var(--space-sm)',
  borderRadius: '6px',
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  outline: 'none',
  boxSizing: 'border-box',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--space-xs) var(--space-sm)',
  borderRadius: '6px',
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  fontFamily: 'monospace',
  fontSize: 'var(--font-small-size)',
  resize: 'vertical',
  outline: 'none',
  minHeight: '140px',
  boxSizing: 'border-box',
};

const footerStyle: React.CSSProperties = {
  padding: 'var(--space-md) var(--space-lg)',
  borderTop: '1px solid var(--border-subtle)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 'var(--space-xs)',
};

const errorTextStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  color: 'var(--color-error, #f87171)',
  margin: 0,
  width: '100%',
  textAlign: 'right',
};

const submitButtonStyle: React.CSSProperties = {
  padding: 'var(--space-xs) var(--space-md)',
  borderRadius: '6px',
  border: 'none',
  background: 'var(--accent-primary, #d97757)',
  color: '#faf9f5',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'opacity 0.15s ease',
};

const skeletonBarStyle: React.CSSProperties = {
  height: '14px',
  borderRadius: '4px',
  background: 'var(--border-subtle)',
  animation: 'skeleton-pulse 1.5s ease-in-out infinite',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PrModal({ isOpen, onClose, onNavigate }: PrModalProps): React.ReactElement {
  ensureSkeletonKeyframes();

  const { send, on } = useWebSocket();

  const [title, setTitle] = useState('');
  const [prBody, setPrBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Request suggestion when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setError(null);
    setSubmitting(false);
    // phaseNumber is not relevant for PR -- send 0 as placeholder
    void send('pr:suggest', { phaseNumber: 0 });
  }, [isOpen, send]);

  // Listen for PR messages
  useEffect(() => {
    if (!isOpen) return;

    const unsubSuggestion = on('pr:suggestion', (msg: WebSocketMessage) => {
      const { payload } = msg as PrSuggestionMessage;
      setTitle(payload.title);
      setPrBody(payload.body);
      setLoading(false);
    });

    const unsubCreated = on('pr:created', (msg: WebSocketMessage) => {
      const { payload } = msg as PrCreatedMessage;
      // Open PR URL in browser
      if (payload.prUrl) {
        window.open(payload.prUrl, '_blank', 'noopener,noreferrer');
      }
      onClose();
      onNavigate('dashboard');
    });

    const unsubError = on('pr:error', (msg: WebSocketMessage) => {
      const { payload } = msg as PrErrorMessage;
      setError(payload.error);
      setLoading(false);
      setSubmitting(false);
    });

    return () => {
      unsubSuggestion();
      unsubCreated();
      unsubError();
    };
  }, [isOpen, on, onClose, onNavigate]);

  const handleSubmit = useCallback(() => {
    if (title.trim().length === 0) {
      setError('PR title is required.');
      return;
    }
    setError(null);
    setSubmitting(true);
    void send('pr:create', { title: title.trim(), body: prBody.trim() });
  }, [title, prBody, send]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="pr-modal-overlay"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.2 }}
          style={overlayStyle}
          onClick={handleOverlayClick}
          onKeyDown={handleKeyDown}
          role="dialog"
          aria-modal="true"
          aria-label="Open Pull Request"
        >
          <motion.div
            key="pr-modal"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={modalStyle}
          >
            {/* Header */}
            <div style={headerStyle}>
              <h2 style={headerTitleStyle}>Open Pull Request</h2>
              <button
                type="button"
                style={closeButtonStyle}
                onClick={onClose}
                aria-label="Close modal"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-surface)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                &#x2715;
              </button>
            </div>

            {/* Body */}
            <div style={bodyStyle}>
              {loading ? (
                <>
                  <div style={{ ...skeletonBarStyle, width: '70%' }} />
                  <div style={{ ...skeletonBarStyle, width: '100%', height: '120px' }} />
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="PR title"
                    style={inputStyle}
                    aria-label="Pull request title"
                    autoFocus
                  />
                  <textarea
                    value={prBody}
                    onChange={(e) => setPrBody(e.target.value)}
                    placeholder="Describe your changes..."
                    style={textareaStyle}
                    rows={8}
                    aria-label="Pull request body"
                  />
                </>
              )}
            </div>

            {/* Footer */}
            <div style={footerStyle}>
              {error !== null && <p style={errorTextStyle}>{error}</p>}
              <button
                type="button"
                style={{
                  ...submitButtonStyle,
                  opacity: loading || submitting ? 0.6 : 1,
                  cursor: loading || submitting ? 'not-allowed' : 'pointer',
                }}
                onClick={handleSubmit}
                disabled={loading || submitting}
                onMouseEnter={(e) => {
                  if (!loading && !submitting) {
                    e.currentTarget.style.opacity = '0.85';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading && !submitting) {
                    e.currentTarget.style.opacity = '1';
                  }
                }}
              >
                {submitting ? 'Creating PR...' : 'Open PR'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
