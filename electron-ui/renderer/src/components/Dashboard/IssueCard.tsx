/**
 * IssueCard -- Renders a single GitHub issue in one of three layout modes.
 *
 * Layout modes:
 *   - full:      Single-line title, typewriter summary (first render only),
 *                label pills, mountain background, author + relative time footer.
 *   - condensed: Title, difficulty icon+text, 1 label + overflow, updated time.
 *   - list:      Single row -- title, difficulty text, labels (max 3 + overflow), updated time.
 *
 * Uses Framer Motion `layoutId` keyed by issue number for smooth layout transitions.
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { ScoredIssue, IssueDifficulty } from '@shared/types/entities';
import { DifficultyIcon } from './DifficultyIcon';
import { formatRelativeTime } from '../../utils/formatRelativeTime';

export type IssueLayoutMode = 'full' | 'condensed' | 'list';

interface IssueCardProps {
  issue: ScoredIssue;
  layout: IssueLayoutMode;
  onClick: () => void;
  index?: number;
}

// ---------------------------------------------------------------------------
// Module-level typewriter tracking — survives remounts
// ---------------------------------------------------------------------------

const animatedSummaries = new Set<number>();

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
  border: '1px solid transparent',
  cursor: 'pointer',
  transition: 'border-color 0.15s ease',
  background: 'var(--bg-elevated)',
  overflow: 'hidden',
};

const fullCardStyle: React.CSSProperties = {
  ...cardBaseStyle,
  padding: 'var(--space-md)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-sm)',
  height: '100%',
  position: 'relative',
};

const condensedCardStyle: React.CSSProperties = {
  ...cardBaseStyle,
  padding: 'var(--space-sm) var(--space-md)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-xs)',
};

const listCardStyle = (index: number): React.CSSProperties => ({
  borderRadius: '4px',
  cursor: 'pointer',
  transition: 'background 0.15s ease',
  overflow: 'hidden',
  padding: 'var(--space-xs) var(--space-md)',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 'var(--space-md)',
  background: index % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
});

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

const fullTitleStyle: React.CSSProperties = {
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
  fontWeight: 600,
  lineHeight: 1.4,
  margin: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  flex: 1,
  minWidth: 0,
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

const summaryWrapperStyle: React.CSSProperties = {
  height: '36px',
  overflow: 'hidden',
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
  borderRadius: '4px',
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
  borderRadius: '4px',
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

const footerRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: 'auto',
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

const mountainBackgroundStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '8px',
  right: '8px',
  opacity: 0.15,
  pointerEvents: 'none',
  zIndex: 0,
};

const cardContentStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-sm)',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LabelPills({ labels, maxVisible }: { labels: ScoredIssue['labels']; maxVisible: number }) {
  const visible = labels.slice(0, maxVisible);
  const overflowCount = labels.length - maxVisible;

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', flexWrap: 'wrap' }}
    >
      {visible.map((label) => (
        <span key={label.name} style={labelPillStyle(label.color)}>
          {label.name}
        </span>
      ))}
      {overflowCount > 0 && <span style={overflowPillStyle}>+{overflowCount}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Typewriter text for summary
// ---------------------------------------------------------------------------

const summaryPlaceholderStyle: React.CSSProperties = {
  ...summaryStyle,
  minHeight: '2.8em', // Reserve ~2 lines to prevent layout shift
};

function TypewriterText({
  text,
  delay = 400,
  skipAnimation,
  onComplete,
}: {
  text: string;
  delay?: number;
  skipAnimation?: boolean;
  onComplete?: () => void;
}) {
  const [displayedLength, setDisplayedLength] = useState(skipAnimation ? text.length : 0);
  const [started, setStarted] = useState(skipAnimation ? true : false);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const completedRef = useRef(skipAnimation ? true : false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Delay before starting the typewriter
  useEffect(() => {
    if (skipAnimation) return;
    const timer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(timer);
  }, [delay, skipAnimation]);

  // Animate characters using rAF for smooth performance
  useEffect(() => {
    if (!started || !text || skipAnimation) return;

    const totalChars = text.length;
    // ~30 chars per second
    const duration = totalChars * 33;
    startTimeRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const chars = Math.floor(progress * totalChars);
      setDisplayedLength(chars);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current?.();
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [started, text, skipAnimation]);

  if (!text) return null;

  return (
    <p style={summaryPlaceholderStyle}>
      {text.slice(0, displayedLength)}
      {displayedLength < text.length && (
        <span
          style={{
            display: 'inline-block',
            width: '2px',
            height: '1em',
            background: 'var(--accent-primary)',
            marginLeft: '1px',
            verticalAlign: 'text-bottom',
            animation: 'breathe 1s ease-in-out infinite',
          }}
        />
      )}
    </p>
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

export function IssueCard({ issue, layout, onClick, index = 0 }: IssueCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderColor = 'var(--accent-primary)';
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderColor = 'transparent';
  };

  if (layout === 'list') {
    return (
      <motion.div
        layoutId={`issue-${issue.number}`}
        variants={cardVariants}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={listCardStyle(index)}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background =
            index % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)';
        }}
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
        {issue.labels.length > 0 && <LabelPills labels={issue.labels} maxVisible={3} />}
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
          <p style={fullTitleStyle}>{issue.title}</p>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-sm)',
          }}
        >
          {issue.labels.length > 0 ? <LabelPills labels={issue.labels} maxVisible={1} /> : <div />}
          <span style={difficultyBadgeStyle}>{DIFFICULTY_LABELS[issue.difficulty]}</span>
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
      {/* Mountain background watermark */}
      <div style={mountainBackgroundStyle}>
        <DifficultyIcon level={issue.difficulty} size={120} />
      </div>

      {/* Card content layered above mountain */}
      <div style={cardContentStyle}>
        {/* Title row — single line */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-xs)' }}>
          <span style={issueNumberCardStyle}>#{issue.number}</span>
          <p style={fullTitleStyle}>{issue.title}</p>
        </div>

        {/* Summary with typewriter animation (first render only) */}
        <div style={summaryWrapperStyle}>
          {issue.summary ? (
            <TypewriterText
              text={issue.summary}
              delay={500}
              skipAnimation={animatedSummaries.has(issue.number)}
              onComplete={() => animatedSummaries.add(issue.number)}
            />
          ) : null}
        </div>

        {/* Labels only */}
        {issue.labels.length > 0 && <LabelPills labels={issue.labels} maxVisible={3} />}

        {/* Footer: author left, time right */}
        <div style={footerRowStyle}>
          <div style={authorStyle}>
            <img src={issue.author.avatarUrl} alt={issue.author.login} style={avatarStyle} />
            <span>{issue.author.login}</span>
          </div>
          <span style={timeStyle}>{formatRelativeTime(issue.updatedAt)}</span>
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
