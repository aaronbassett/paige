/**
 * CompletionModal -- Modal dialog for answering a comprehension question
 * after viewing a learning material.
 *
 * Displays the material title, the AI-generated question, a textarea for
 * the learner's answer, and submit/cancel actions. Uses framer-motion for
 * overlay and modal enter/exit animations with spring physics.
 *
 * The overlay click-to-dismiss pattern follows the same convention as
 * IssueModal in the Dashboard.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LearningMaterial } from '@shared/types/entities';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompletionModalProps {
  material: LearningMaterial;
  onSubmit: (id: number, answer: string) => void;
  onClose: () => void;
  submitting?: boolean;
  feedback?: string | null;
}

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
};

const modalStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  borderRadius: '12px',
  border: '1px solid var(--border-subtle)',
  width: '100%',
  maxWidth: '520px',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  padding: 'var(--space-md) var(--space-lg)',
  borderBottom: '1px solid var(--border-subtle)',
};

const bodyStyle: React.CSSProperties = {
  padding: 'var(--space-lg)',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-md)',
};

const footerStyle: React.CSSProperties = {
  padding: 'var(--space-md) var(--space-lg)',
  borderTop: '1px solid var(--border-subtle)',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 'var(--space-sm)',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '100px',
  padding: 'var(--space-sm)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '6px',
  color: 'var(--text-primary)',
  fontSize: 'var(--text-sm)',
  fontFamily: 'inherit',
  resize: 'vertical',
};

const btnStyle: React.CSSProperties = {
  padding: 'var(--space-xs) var(--space-md)',
  borderRadius: '6px',
  border: 'none',
  cursor: 'pointer',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
};

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
// Component
// ---------------------------------------------------------------------------

export function CompletionModal({
  material,
  onSubmit,
  onClose,
  submitting = false,
  feedback = null,
}: CompletionModalProps) {
  const [answer, setAnswer] = useState('');

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSubmit = () => {
    if (answer.trim()) {
      onSubmit(material.id, answer.trim());
    }
  };

  const canSubmit = answer.trim().length > 0 && !submitting;

  return (
    <AnimatePresence>
      <motion.div
        data-testid="modal-overlay"
        style={overlayStyle}
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={handleOverlayClick}
      >
        <motion.div
          role="dialog"
          aria-label={`Comprehension check: ${material.title}`}
          style={modalStyle}
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          <div style={headerStyle}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '16px' }}>
              {material.title}
            </h3>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>
              Comprehension check
            </p>
          </div>

          <div style={bodyStyle}>
            <p
              style={{
                margin: 0,
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                lineHeight: 1.5,
              }}
            >
              {material.question}
            </p>
            <textarea
              style={textareaStyle}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer here..."
              disabled={submitting}
            />
            {feedback && (
              <p
                style={{
                  margin: 0,
                  padding: 'var(--space-sm)',
                  background: 'rgba(224, 82, 82, 0.1)',
                  border: '1px solid rgba(224, 82, 82, 0.3)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)',
                  lineHeight: 1.5,
                }}
                role="alert"
              >
                {feedback}
              </p>
            )}
          </div>

          <div style={footerStyle}>
            <button
              style={{ ...btnStyle, background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              style={{
                ...btnStyle,
                background: canSubmit ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                color: canSubmit ? '#fff' : 'var(--text-muted)',
                opacity: submitting ? 0.6 : 1,
              }}
              onClick={handleSubmit}
              disabled={!canSubmit}
              aria-label="Submit answer"
            >
              {submitting ? 'Checking...' : 'Submit'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
