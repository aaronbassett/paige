/**
 * IssueCard -- Renders a single GitHub issue in one of three layout modes.
 *
 * Layout modes:
 *   - full:      Title, summary, difficulty mountain+text, labels (max 3 + overflow),
 *                updated time, author avatar+name, assignees (stacked), comment count.
 *   - condensed: Title, difficulty icon+text, 1 label + overflow, updated time.
 *   - list:      Single row -- title, difficulty text, labels (max 3 + overflow), updated time.
 *
 * Uses Framer Motion `layoutId` keyed by issue number for smooth layout transitions.
 */

import { motion } from 'framer-motion';
import type { ScoredIssue, IssueDifficulty } from '@shared/types/entities';
import { DifficultyIcon } from './DifficultyIcon';
import { formatRelativeTime } from '../../utils/formatRelativeTime';

export type IssueLayoutMode = 'full' | 'condensed' | 'list';

interface IssueCardProps {
  issue: ScoredIssue;
  layout: IssueLayoutMode;
  onClick: () => void;
}

// ---------------------------------------------------------------------------
// Difficulty label map
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

const cardBaseStyle: React.CSSProperties = {
  borderRadius: '8px',
  border: '1px solid var(--border-subtle)',
  cursor: 'pointer',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  background: 'var(--bg-elevated)',
  overflow: 'hidden',
};

const fullCardStyle: React.CSSProperties = {
  ...cardBaseStyle,
  padding: 'var(--space-md)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-sm)',
};

const condensedCardStyle: React.CSSProperties = {
  ...cardBaseStyle,
  padding: 'var(--space-sm) var(--space-md)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-xs)',
};

const listCardStyle: React.CSSProperties = {
  ...cardBaseStyle,
  padding: 'var(--space-xs) var(--space-md)',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 'var(--space-md)',
};

const titleStyle: React.CSSProperties = {
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
  fontWeight: 600,
  lineHeight: 1.4,
  margin: 0,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const listTitleStyle: React.CSSProperties = {
  ...titleStyle,
  flex: 1,
  minWidth: 0,
  WebkitLineClamp: 1,
};

const summaryStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  lineHeight: 1.5,
  margin: 0,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const metaRowStyle: React.CSSProperties = {
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
  whiteSpace: 'nowrap',
});

const overflowPillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '10px',
  padding: '2px 8px',
  fontSize: 'var(--font-small-size)',
  fontFamily: 'var(--font-family)',
  backgroundColor: 'var(--bg-surface)',
  color: 'var(--text-muted)',
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
};

const timeStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  whiteSpace: 'nowrap',
};

const authorRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-sm)',
  marginTop: 'var(--space-xs)',
};

const authorStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-xs)',
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LabelPills({
  labels,
  maxVisible,
}: {
  labels: ScoredIssue['labels'];
  maxVisible: number;
}) {
  const visible = labels.slice(0, maxVisible);
  const overflowCount = labels.length - maxVisible;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
      {visible.map((label) => (
        <span key={label.name} style={labelPillStyle(label.color)}>
          {label.name}
        </span>
      ))}
      {overflowCount > 0 && (
        <span style={overflowPillStyle}>+{overflowCount}</span>
      )}
    </div>
  );
}

function CommentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M2.5 1C1.67 1 1 1.67 1 2.5v8C1 11.33 1.67 12 2.5 12H5l3 3 3-3h2.5c.83 0 1.5-.67 1.5-1.5v-8C15 1.67 14.33 1 13.5 1h-11z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Entrance animation variant
// ---------------------------------------------------------------------------

const cardVariants = {
  initial: { opacity: 0, y: 12, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IssueCard({ issue, layout, onClick }: IssueCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderColor = 'var(--accent-primary)';
    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderColor = '';
    e.currentTarget.style.boxShadow = '';
  };

  if (layout === 'list') {
    return (
      <motion.div
        layoutId={`issue-${issue.number}`}
        variants={cardVariants}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={listCardStyle}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        role="button"
        tabIndex={0}
        aria-label={`Issue #${issue.number}: ${issue.title}`}
      >
        <span style={{ ...issueNumberCardStyle, flexShrink: 0 }}>#{issue.number}</span>
        <p style={listTitleStyle}>{issue.title}</p>
        <span style={difficultyBadgeStyle}>
          <DifficultyIcon level={issue.difficulty} size={16} />
          {DIFFICULTY_LABELS[issue.difficulty]}
        </span>
        {issue.labels.length > 0 && (
          <LabelPills labels={issue.labels} maxVisible={3} />
        )}
        <span style={timeStyle}>{formatRelativeTime(issue.updatedAt)}</span>
      </motion.div>
    );
  }

  if (layout === 'condensed') {
    return (
      <motion.div
        layoutId={`issue-${issue.number}`}
        variants={cardVariants}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={condensedCardStyle}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        role="button"
        tabIndex={0}
        aria-label={`Issue #${issue.number}: ${issue.title}`}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-xs)' }}>
          <span style={issueNumberCardStyle}>#{issue.number}</span>
          <p style={titleStyle}>{issue.title}</p>
        </div>
        <div style={metaRowStyle}>
          <span style={difficultyBadgeStyle}>
            <DifficultyIcon level={issue.difficulty} size={16} />
            {DIFFICULTY_LABELS[issue.difficulty]}
          </span>
          {issue.labels.length > 0 && (
            <LabelPills labels={issue.labels} maxVisible={1} />
          )}
          <span style={timeStyle}>{formatRelativeTime(issue.updatedAt)}</span>
        </div>
      </motion.div>
    );
  }

  // Full layout
  return (
    <motion.div
      layoutId={`issue-${issue.number}`}
      variants={cardVariants}
      initial="initial"
      animate="animate"
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={fullCardStyle}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="button"
      tabIndex={0}
      aria-label={`Issue #${issue.number}: ${issue.title}`}
    >
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-xs)' }}>
        <span style={issueNumberCardStyle}>#{issue.number}</span>
        <p style={titleStyle}>{issue.title}</p>
      </div>

      {/* Summary */}
      {issue.summary && (
        <p style={summaryStyle}>{issue.summary}</p>
      )}

      {/* Metadata row: difficulty + labels + time */}
      <div style={metaRowStyle}>
        <span style={difficultyBadgeStyle}>
          <DifficultyIcon level={issue.difficulty} size={18} />
          {DIFFICULTY_LABELS[issue.difficulty]}
        </span>
        {issue.labels.length > 0 && (
          <LabelPills labels={issue.labels} maxVisible={3} />
        )}
        <span style={timeStyle}>{formatRelativeTime(issue.updatedAt)}</span>
      </div>

      {/* Author row: avatar+name, assignees, comment count */}
      <div style={authorRowStyle}>
        <div style={authorStyle}>
          <img
            src={issue.author.avatarUrl}
            alt={issue.author.login}
            style={avatarStyle}
          />
          <span>{issue.author.login}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          {/* Stacked assignee avatars */}
          {issue.assignees.length > 0 && (
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
          )}

          {/* Comment count */}
          {issue.commentCount > 0 && (
            <span style={commentCountStyle}>
              <CommentIcon />
              {issue.commentCount}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Additional shared style
// ---------------------------------------------------------------------------

const issueNumberCardStyle: React.CSSProperties = {
  color: 'var(--accent-primary)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
  fontWeight: 600,
  flexShrink: 0,
};
