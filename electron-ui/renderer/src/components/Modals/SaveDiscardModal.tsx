/**
 * SaveDiscardModal -- Confirmation dialog for unsaved changes.
 *
 * Presents the user with two options: save and exit, or discard changes.
 * Used when navigating away from the IDE with a dirty buffer state.
 *
 * Follows the IssueModal pattern for overlay/animation structure.
 */

import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SaveDiscardModalProps {
  isOpen: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onClose: () => void;
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
  maxWidth: '420px',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  position: 'relative',
};

const headerStyle: React.CSSProperties = {
  padding: 'var(--space-md) var(--space-lg)',
  borderBottom: '1px solid var(--border-subtle)',
};

const headerTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-base-size)',
  fontWeight: 600,
  color: 'var(--text-primary)',
  margin: 0,
};

const bodyStyle: React.CSSProperties = {
  padding: 'var(--space-md) var(--space-lg)',
};

const bodyTextStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-secondary)',
  lineHeight: 1.6,
  margin: 0,
};

const footerStyle: React.CSSProperties = {
  padding: 'var(--space-md) var(--space-lg)',
  borderTop: '1px solid var(--border-subtle)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 'var(--space-sm)',
};

const saveButtonStyle: React.CSSProperties = {
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

const discardButtonStyle: React.CSSProperties = {
  padding: 'var(--space-xs) var(--space-md)',
  borderRadius: '6px',
  border: '1px solid var(--color-error, #f87171)',
  background: 'transparent',
  color: 'var(--color-error, #f87171)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
  cursor: 'pointer',
  transition: 'background 0.15s ease, opacity 0.15s ease',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SaveDiscardModal({
  isOpen,
  onSave,
  onDiscard,
  onClose,
}: SaveDiscardModalProps): React.ReactElement {
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
          key="save-discard-overlay"
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
          aria-label="Unsaved changes"
        >
          <motion.div
            key="save-discard-modal"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={modalStyle}
          >
            {/* Header */}
            <div style={headerStyle}>
              <h2 style={headerTitleStyle}>Unsaved Changes</h2>
            </div>

            {/* Body */}
            <div style={bodyStyle}>
              <p style={bodyTextStyle}>
                You have unsaved changes. Would you like to save your progress or discard it?
              </p>
            </div>

            {/* Footer */}
            <div style={footerStyle}>
              <button
                type="button"
                style={discardButtonStyle}
                onClick={onDiscard}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                Discard Changes
              </button>
              <button
                type="button"
                style={saveButtonStyle}
                onClick={onSave}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.85';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                Save &amp; Exit
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
