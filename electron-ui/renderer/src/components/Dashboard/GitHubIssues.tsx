/**
 * GitHubIssues — Dashboard section showing assigned GitHub issues.
 *
 * Displays a scrollable list of issue cards with colored label pills.
 * Clicking an issue triggers navigation to the IDE view for that issue.
 * Handles loading (skeleton), empty, and populated states.
 */

interface GitHubIssuesProps {
  issues: Array<{
    number: number;
    title: string;
    labels: Array<{ name: string; color: string }>;
    url: string;
  }> | null;
  onIssueClick: (issueNumber: number) => void;
}

/**
 * Determines whether white or dark text provides better contrast
 * against the given hex background color using luminance calculation.
 */
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

const containerStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  padding: 'var(--space-md)',
  borderRadius: '8px',
};

const listStyle: React.CSSProperties = {
  maxHeight: '300px',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-sm)',
};

const cardStyle: React.CSSProperties = {
  padding: 'var(--space-sm) var(--space-md)',
  borderRadius: '6px',
  border: '1px solid var(--border-subtle)',
  cursor: 'pointer',
  transition: 'background 0.15s ease',
};

const issueNumberStyle: React.CSSProperties = {
  color: 'var(--accent-primary)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
  fontWeight: 600,
  marginRight: 'var(--space-xs)',
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
  lineHeight: 1.4,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  margin: 0,
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
  borderRadius: '10px',
  padding: '2px 8px',
  fontSize: 'var(--font-small-size)',
  fontFamily: 'var(--font-family)',
  backgroundColor: color.startsWith('#') ? color : `#${color}`,
  color: getContrastColor(color),
  lineHeight: 1.4,
});

const skeletonCardStyle: React.CSSProperties = {
  ...cardStyle,
  cursor: 'default',
  height: '60px',
  background: 'var(--bg-elevated)',
  opacity: 0.5,
};

const emptyStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
  textAlign: 'center',
  padding: 'var(--space-md)',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GitHubIssues({ issues, onIssueClick }: GitHubIssuesProps) {
  return (
    <div style={containerStyle}>
      <pre className="figlet-header" style={{ fontSize: '18px' }}>
        ISSUES
      </pre>

      {/* Loading state: skeleton placeholders */}
      {issues === null && (
        <div style={listStyle}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={skeletonCardStyle} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {issues !== null && issues.length === 0 && <p style={emptyStyle}>No issues assigned</p>}

      {/* Populated state */}
      {issues !== null && issues.length > 0 && (
        <div style={listStyle}>
          {issues.map((issue) => (
            <div
              key={issue.number}
              style={cardStyle}
              onClick={() => onIssueClick(issue.number)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-elevated)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = '';
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onIssueClick(issue.number);
                }
              }}
              aria-label={`Issue #${issue.number}: ${issue.title}`}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <span style={issueNumberStyle}>#{issue.number}</span>
                <p style={titleStyle}>{issue.title}</p>
              </div>

              {issue.labels.length > 0 && (
                <div style={labelsContainerStyle}>
                  {issue.labels.map((label) => (
                    <span key={label.name} style={labelPillStyle(label.color)}>
                      {label.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
