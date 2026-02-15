/**
 * CommitModal -- Modal dialog for composing and executing a git commit.
 *
 * On open, sends `commit:suggest` via WebSocket to request an AI-generated
 * commit message. Populates the form when `commit:suggestion` is received.
 * On submit, sends `commit:execute` with the conventional commit fields.
 *
 * Follows the IssueModal pattern for overlay/animation structure.
 * Closes automatically on `phase:transition`.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebSocket } from '../../hooks/useWebSocket';
import type {
  WebSocketMessage,
  CommitSuggestionMessage,
  CommitErrorMessage,
} from '@shared/types/websocket-messages';
import type { ConventionalCommitType } from '@shared/types/entities';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CommitModalProps {
  isOpen: boolean;
  phaseNumber: number;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMMIT_TYPES: ConventionalCommitType[] = [
  'fix',
  'feat',
  'docs',
  'style',
  'refactor',
  'test',
  'chore',
  'perf',
  'ci',
  'build',
];

// ---------------------------------------------------------------------------
// Skeleton keyframes
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
  maxWidth: '560px',
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

const row1Style: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-sm)',
  alignItems: 'stretch',
};

const selectStyle: React.CSSProperties = {
  width: '120px',
  flexShrink: 0,
  padding: 'var(--space-xs) var(--space-sm)',
  borderRadius: '6px',
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  outline: 'none',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: 'var(--space-xs) var(--space-sm)',
  borderRadius: '6px',
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  outline: 'none',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--space-xs) var(--space-sm)',
  borderRadius: '6px',
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  resize: 'vertical',
  outline: 'none',
  minHeight: '80px',
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

export function CommitModal({
  isOpen,
  phaseNumber,
  onClose,
}: CommitModalProps): React.ReactElement {
  ensureSkeletonKeyframes();

  const { send, on } = useWebSocket();

  const [commitType, setCommitType] = useState<ConventionalCommitType>('feat');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Request suggestion when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setError(null);
    setSubmitting(false);
    void send('commit:suggest', { phaseNumber });
  }, [isOpen, phaseNumber, send]);

  // Listen for commit messages
  useEffect(() => {
    if (!isOpen) return;

    const unsubSuggestion = on('commit:suggestion', (msg: WebSocketMessage) => {
      const { payload } = msg as CommitSuggestionMessage;
      setCommitType(payload.type);
      setSubject(payload.subject);
      setBody(payload.body);
      setLoading(false);
    });

    const unsubError = on('commit:error', (msg: WebSocketMessage) => {
      const { payload } = msg as CommitErrorMessage;
      setError(payload.error);
      setLoading(false);
      setSubmitting(false);
    });

    const unsubTransition = on('phase:transition', () => {
      onClose();
    });

    return () => {
      unsubSuggestion();
      unsubError();
      unsubTransition();
    };
  }, [isOpen, on, onClose]);

  const handleSubmit = useCallback(() => {
    if (subject.trim().length === 0) {
      setError('Subject is required.');
      return;
    }
    setError(null);
    setSubmitting(true);
    void send('commit:execute', { type: commitType, subject: subject.trim(), body: body.trim() });
  }, [commitType, subject, body, send]);

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
          key="commit-modal-overlay"
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
          aria-label={`Commit Phase ${phaseNumber}`}
        >
          <motion.div
            key="commit-modal"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={modalStyle}
          >
            {/* Header */}
            <div style={headerStyle}>
              <h2 style={headerTitleStyle}>Commit Phase {phaseNumber}</h2>
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
                  <div style={{ ...skeletonBarStyle, width: '40%' }} />
                  <div style={{ ...skeletonBarStyle, width: '80%' }} />
                  <div style={{ ...skeletonBarStyle, width: '60%', height: '60px' }} />
                </>
              ) : (
                <>
                  {/* Row 1: type select + subject input */}
                  <div style={row1Style}>
                    <select
                      value={commitType}
                      onChange={(e) => setCommitType(e.target.value as ConventionalCommitType)}
                      style={selectStyle}
                      aria-label="Commit type"
                    >
                      {COMMIT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Commit subject"
                      style={inputStyle}
                      aria-label="Commit subject"
                      autoFocus
                    />
                  </div>

                  {/* Row 2: body textarea */}
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Optional commit body (details, reasoning, etc.)"
                    style={textareaStyle}
                    rows={5}
                    aria-label="Commit body"
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
                {submitting ? 'Committing...' : 'Commit changes'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
