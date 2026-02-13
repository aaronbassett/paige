/**
 * IssueModal -- Full-screen overlay showing issue details.
 *
 * Displays:
 *   - Title with issue number
 *   - Metadata bar: difficulty icon, author, assignees, comment count, updated time
 *   - All labels (no overflow limit)
 *   - Markdown body rendered via react-markdown + remark-gfm
 *   - "View on GitHub" button (opens htmlUrl in browser)
 *   - "Work on this" button (sends session:select_issue, navigates to IDE)
 *
 * Uses Framer Motion for overlay fade and modal scale entrance.
 */

import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ScoredIssue, IssueDifficulty, AppView } from '@shared/types/entities';
import { DifficultyIcon } from './DifficultyIcon';
import { formatRelativeTime } from '../../utils/formatRelativeTime';
import { useWebSocket } from '../../hooks/useWebSocket';

interface IssueModalProps {
  issue: ScoredIssue | null;
  onClose: () => void;
  onNavigate: (view: AppView, context?: { issueNumber?: number }) => void;
}

// ---------------------------------------------------------------------------
// Difficulty labels
// ---------------------------------------------------------------------------

const DIFFICULTY_LABELS: Record<IssueDifficulty, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  very_high: 'Very High',
  extreme: 'Extreme',
};

// ---------------------------------------------------------------------------
// Label contrast helper
// ---------------------------------------------------------------------------

function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1a1a18' : '#faf9f5';
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
  padding: 'var(--space-lg)',
};

const modalStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  borderRadius: '12px',
  border: '1px solid var(--border-subtle)',
  width: '100%',
  maxWidth: '720px',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  padding: 'var(--space-lg)',
  borderBottom: '1px solid var(--border-subtle)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-sm)',
};

const titleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 'var(--space-sm)',
};

const issueNumberStyle: React.CSSProperties = {
  color: 'var(--accent-primary)',
  fontFamily: 'var(--font-family)',
  fontSize: '20px',
  fontWeight: 600,
  flexShrink: 0,
};

const titleTextStyle: React.CSSProperties = {
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-family)',
  fontSize: '20px',
  fontWeight: 600,
  lineHeight: 1.3,
  margin: 0,
};

const metaBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
  flexWrap: 'wrap',
};

const difficultyBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: 'var(--font-small-size)',
  fontFamily: 'var(--font-family)',
  color: 'var(--text-secondary)',
};

const authorStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: 'var(--font-small-size)',
  fontFamily: 'var(--font-family)',
  color: 'var(--text-secondary)',
};

const avatarStyle: React.CSSProperties = {
  width: '20px',
  height: '20px',
  borderRadius: '50%',
  objectFit: 'cover',
};

const stackedAvatarStyle = (index: number): React.CSSProperties => ({
  ...avatarStyle,
  width: '18px',
  height: '18px',
  border: '2px solid var(--bg-elevated)',
  marginLeft: index > 0 ? '-6px' : '0',
  position: 'relative',
  zIndex: 10 - index,
});

const commentCountStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '3px',
  color: 'var(--text-muted)',
  fontSize: 'var(--font-small-size)',
  fontFamily: 'var(--font-family)',
};

const timeStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
};

const labelsRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--space-xs)',
};

const labelPillStyle = (color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '10px',
  padding: '2px 8px',
  fontSize: 'var(--font-small-size)',
  fontFamily: 'var(--font-family)',
  backgroundColor: color.startsWith('#') ? color : `#${color}`,
  color: getContrastColor(color),
  lineHeight: 1.4,
});

const bodyContainerStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 'var(--space-lg)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
  lineHeight: 1.6,
};

const footerStyle: React.CSSProperties = {
  padding: 'var(--space-md) var(--space-lg)',
  borderTop: '1px solid var(--border-subtle)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 'var(--space-sm)',
};

const viewOnGitHubStyle: React.CSSProperties = {
  padding: 'var(--space-xs) var(--space-md)',
  borderRadius: '6px',
  border: '1px solid var(--border-subtle)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
  cursor: 'pointer',
  transition: 'background 0.15s ease',
};

const workOnThisStyle: React.CSSProperties = {
  padding: 'var(--space-xs) var(--space-md)',
  borderRadius: '6px',
  border: 'none',
  background: 'var(--accent-primary)',
  color: '#faf9f5',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'opacity 0.15s ease',
};

const closeButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'var(--space-sm)',
  right: 'var(--space-sm)',
  width: '32px',
  height: '32px',
  borderRadius: '6px',
  border: 'none',
  background: 'transparent',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '18px',
  fontFamily: 'var(--font-family)',
  transition: 'background 0.15s ease',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CommentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M2.5 1C1.67 1 1 1.67 1 2.5v8C1 11.33 1.67 12 2.5 12H5l3 3 3-3h2.5c.83 0 1.5-.67 1.5-1.5v-8C15 1.67 14.33 1 13.5 1h-11z" />
    </svg>
  );
}

function DotSeparator() {
  return (
    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }} aria-hidden="true">
      &#x2022;
    </span>
  );
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
// Component
// ---------------------------------------------------------------------------

export function IssueModal({ issue, onClose, onNavigate }: IssueModalProps) {
  const { send } = useWebSocket();

  const handleViewOnGitHub = useCallback(() => {
    if (issue) {
      window.open(issue.htmlUrl, '_blank');
    }
  }, [issue]);

  const handleWorkOnThis = useCallback(() => {
    if (issue) {
      send('session:select_issue', { issueNumber: issue.number });
      onNavigate('ide', { issueNumber: issue.number });
    }
  }, [issue, send, onNavigate]);

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
      {issue && (
        <motion.div
          key="issue-modal-overlay"
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
          aria-label={`Issue #${issue.number}: ${issue.title}`}
        >
          <motion.div
            key="issue-modal"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{ ...modalStyle, position: 'relative' }}
          >
            {/* Close button */}
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

            {/* Header */}
            <div style={headerStyle}>
              <div style={titleRowStyle}>
                <span style={issueNumberStyle}>#{issue.number}</span>
                <h2 style={titleTextStyle}>{issue.title}</h2>
              </div>

              {/* Metadata bar */}
              <div style={metaBarStyle}>
                <span style={difficultyBadgeStyle}>
                  <DifficultyIcon level={issue.difficulty} size={20} />
                  {DIFFICULTY_LABELS[issue.difficulty]}
                </span>
                <DotSeparator />
                <span style={authorStyle}>
                  <img
                    src={issue.author.avatarUrl}
                    alt={issue.author.login}
                    style={avatarStyle}
                  />
                  {issue.author.login}
                </span>
                {issue.assignees.length > 0 && (
                  <>
                    <DotSeparator />
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {issue.assignees.map((assignee, i) => (
                        <img
                          key={assignee.login}
                          src={assignee.avatarUrl}
                          alt={assignee.login}
                          title={assignee.login}
                          style={stackedAvatarStyle(i)}
                        />
                      ))}
                    </div>
                  </>
                )}
                {issue.commentCount > 0 && (
                  <>
                    <DotSeparator />
                    <span style={commentCountStyle}>
                      <CommentIcon />
                      {issue.commentCount}
                    </span>
                  </>
                )}
                <DotSeparator />
                <span style={timeStyle}>
                  Updated {formatRelativeTime(issue.updatedAt)}
                </span>
              </div>

              {/* All labels */}
              {issue.labels.length > 0 && (
                <div style={labelsRowStyle}>
                  {issue.labels.map((label) => (
                    <span key={label.name} style={labelPillStyle(label.color)}>
                      {label.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Body */}
            <div style={bodyContainerStyle} className="markdown-body">
              <Markdown remarkPlugins={[remarkGfm]}>
                {issue.body || '_No description provided._'}
              </Markdown>
            </div>

            {/* Footer */}
            <div style={footerStyle}>
              <button
                type="button"
                style={viewOnGitHubStyle}
                onClick={handleViewOnGitHub}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-surface)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                View on GitHub
              </button>
              <button
                type="button"
                style={workOnThisStyle}
                onClick={handleWorkOnThis}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.85';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                Work on this
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
