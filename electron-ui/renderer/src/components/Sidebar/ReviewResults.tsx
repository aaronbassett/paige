/**
 * ReviewResults -- Sidebar section displaying code review feedback.
 *
 * Shows the AI review result including overall feedback, per-task
 * feedback (collapsible), phase completion status, and clickable
 * code comments with severity color coding.
 *
 * Loading state renders a pulsing "Reviewing..." indicator.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ReviewResult, ReviewCodeComment, ReviewTaskFeedback } from '@shared/types/entities';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ReviewResultsProps {
  result: ReviewResult | null;
  loading: boolean;
  onDismiss: () => void;
  onCodeCommentClick: (filePath: string, line: number) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<ReviewCodeComment['severity'], string> = {
  praise: 'var(--color-success, #4ade80)',
  suggestion: 'var(--color-warning, #fbbf24)',
  issue: 'var(--color-error, #f87171)',
};

const SEVERITY_LABELS: Record<ReviewCodeComment['severity'], string> = {
  praise: 'Praise',
  suggestion: 'Suggestion',
  issue: 'Issue',
};

/** Unique ID for the pulse keyframes style element. */
const PULSE_STYLE_ID = 'paige-review-pulse-keyframes';

const PULSE_KEYFRAMES = `
@keyframes review-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
`;

function ensurePulseKeyframes(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(PULSE_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = PULSE_STYLE_ID;
  style.textContent = PULSE_KEYFRAMES;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  padding: 'var(--space-sm) var(--space-md)',
};

const loadingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  color: 'var(--accent-primary)',
  animation: 'review-pulse 1.5s ease-in-out infinite',
  padding: 'var(--space-sm) 0',
};

const overallFeedbackStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-primary)',
  lineHeight: 1.6,
  margin: '0 0 var(--space-sm) 0',
};

const phaseCompleteBannerStyle: React.CSSProperties = {
  background: 'var(--color-success, #4ade80)',
  color: '#1a1a18',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  fontWeight: 600,
  padding: 'var(--space-xs) var(--space-sm)',
  borderRadius: '6px',
  marginBottom: 'var(--space-sm)',
  textAlign: 'center',
};

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  margin: 'var(--space-sm) 0 var(--space-xs) 0',
};

const taskItemStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 'var(--space-xs) 0',
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-xs)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-primary)',
  lineHeight: 1.4,
};

const taskFeedbackTextStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-secondary)',
  lineHeight: 1.5,
  margin: 0,
  padding: '0 0 var(--space-xs) var(--space-md)',
};

const codeCommentStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 'var(--space-xs) 0',
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
};

const codeCommentLocationStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-xs)',
  lineHeight: 1.4,
};

const codeCommentTextStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  lineHeight: 1.5,
  margin: 0,
  paddingLeft: 'var(--space-sm)',
};

const dismissButtonStyle: React.CSSProperties = {
  marginTop: 'var(--space-sm)',
  padding: 'var(--space-xs) var(--space-md)',
  borderRadius: '6px',
  border: '1px solid var(--border-subtle)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  cursor: 'pointer',
  width: '100%',
  transition: 'background 0.15s ease',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TaskFeedbackItem({ task }: { task: ReviewTaskFeedback }): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const icon = task.taskComplete ? '\u2713' : '\u2717';
  const iconColor = task.taskComplete
    ? 'var(--color-success, #4ade80)'
    : 'var(--color-error, #f87171)';
  const chevron = expanded ? '\u25BC' : '\u25B6';

  return (
    <li>
      <button
        type="button"
        style={taskItemStyle}
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={`Task: ${task.taskTitle}`}
      >
        <span style={{ color: iconColor, fontSize: 12, flexShrink: 0 }}>{icon}</span>
        <span style={{ flex: 1 }}>{task.taskTitle}</span>
        <span style={{ fontSize: 8, color: 'var(--text-muted)', flexShrink: 0 }}>{chevron}</span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.p
            style={taskFeedbackTextStyle}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
          >
            {task.feedback}
          </motion.p>
        )}
      </AnimatePresence>
    </li>
  );
}

function CodeCommentItem({
  comment,
  onClick,
}: {
  comment: ReviewCodeComment;
  onClick: () => void;
}): React.ReactElement {
  const severityColor = SEVERITY_COLORS[comment.severity];
  const severityLabel = SEVERITY_LABELS[comment.severity];

  // Extract filename from path
  const fileName = comment.filePath.split('/').pop() ?? comment.filePath;

  return (
    <li>
      <button
        type="button"
        style={codeCommentStyle}
        onClick={onClick}
        aria-label={`${severityLabel}: ${fileName} line ${comment.startLine}`}
      >
        <div style={codeCommentLocationStyle}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: severityColor,
              flexShrink: 0,
            }}
            aria-hidden="true"
          />
          <span style={{ color: 'var(--text-primary)' }}>{fileName}</span>
          <span style={{ color: 'var(--text-muted)' }}>
            L{comment.startLine}
            {comment.endLine !== comment.startLine ? `-${comment.endLine}` : ''}
          </span>
          <span style={{ color: severityColor, fontSize: 'calc(var(--font-small-size) - 1px)' }}>
            {severityLabel}
          </span>
        </div>
        <p style={codeCommentTextStyle}>{comment.comment}</p>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReviewResults({
  result,
  loading,
  onDismiss,
  onCodeCommentClick,
}: ReviewResultsProps): React.ReactElement | null {
  ensurePulseKeyframes();

  if (loading) {
    return (
      <div style={containerStyle}>
        <p style={loadingStyle}>Reviewing...</p>
      </div>
    );
  }

  if (result === null) {
    return null;
  }

  const hasTaskFeedback = result.taskFeedback && result.taskFeedback.length > 0;
  const hasCodeComments = result.codeComments.length > 0;

  return (
    <motion.div
      style={containerStyle}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Phase complete banner */}
      {result.phaseComplete === true && (
        <div style={phaseCompleteBannerStyle}>Phase complete -- ready to commit</div>
      )}

      {/* Overall feedback */}
      <p style={overallFeedbackStyle}>{result.overallFeedback}</p>

      {/* Task feedback (collapsible) */}
      {hasTaskFeedback && (
        <>
          <p style={sectionLabelStyle}>Task Feedback</p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }} role="list">
            {result.taskFeedback!.map((task, index) => (
              <TaskFeedbackItem key={index} task={task} />
            ))}
          </ul>
        </>
      )}

      {/* Code comments */}
      {hasCodeComments && (
        <>
          <p style={sectionLabelStyle}>Code Comments</p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }} role="list">
            {result.codeComments.map((comment, index) => (
              <CodeCommentItem
                key={index}
                comment={comment}
                onClick={() => onCodeCommentClick(comment.filePath, comment.startLine)}
              />
            ))}
          </ul>
        </>
      )}

      {/* Dismiss button */}
      <button
        type="button"
        style={dismissButtonStyle}
        onClick={onDismiss}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-surface)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        Dismiss
      </button>
    </motion.div>
  );
}
