/**
 * IssueContext -- Sidebar section displaying the active GitHub issue.
 *
 * Shows issue number (clickable link), title (truncated to 2 lines),
 * colored label pills with auto-contrast text, and an AI summary.
 * Returns null when issueContext is null (parent handles loading state).
 */

import type { IssueContext } from '@shared/types/entities';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IssueContextProps {
  issueContext: IssueContext | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determines whether dark or light text provides better contrast
 * against the given hex background color using relative luminance.
 */
export function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1a1a19' : '#f5f0eb';
}

/**
 * Truncates text to maxLen characters, appending an ellipsis if needed.
 */
function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '\u2026';
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  padding: 'var(--space-md)',
  borderBottom: '1px solid var(--border-subtle)',
};

const issueNumberStyle: React.CSSProperties = {
  color: 'var(--accent-primary)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  fontWeight: 600,
  textDecoration: 'none',
  cursor: 'pointer',
};

const titleStyle: React.CSSProperties = {
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-base-size)',
  fontWeight: 600,
  lineHeight: 1.4,
  margin: 'var(--space-xs) 0',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const labelsContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--space-xs)',
  marginTop: 'var(--space-xs)',
};

const labelPillStyle = (color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '4px',
  padding: '1px 6px',
  fontSize: 'calc(var(--font-label-size) - 1px)',
  fontFamily: 'var(--font-family)',
  backgroundColor: color.startsWith('#') ? color : `#${color}`,
  color: getContrastColor(color),
  lineHeight: 1.4,
});

const summaryTextStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  lineHeight: 1.5,
  margin: 'var(--space-xs) 0 0 0',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IssueContextDisplay({ issueContext }: IssueContextProps) {
  if (issueContext === null) {
    return null;
  }

  const { number: issueNumber, title, summary, labels, url } = issueContext;
  const hasSummary = typeof summary === 'string' && summary.length > 0;
  const displaySummary = hasSummary ? truncateText(summary, 250) : '';

  return (
    <section style={containerStyle} aria-label="Issue context">
      {/* Issue number link */}
      <a
        href={url}
        style={issueNumberStyle}
        onClick={(e) => {
          e.preventDefault();
          window.open(url, '_blank', 'noopener,noreferrer');
        }}
        aria-label={`Issue #${issueNumber}`}
      >
        #{issueNumber}
      </a>

      {/* Title */}
      <h3 style={titleStyle}>{title}</h3>

      {/* Label pills */}
      {labels && labels.length > 0 && (
        <div style={labelsContainerStyle} aria-label="Issue labels">
          {labels.map((label) => (
            <span key={label.name} style={labelPillStyle(label.color)}>
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* AI Summary */}
      {hasSummary && (
        <p id="issue-summary" style={summaryTextStyle}>
          {displaySummary}
        </p>
      )}
    </section>
  );
}
