/**
 * ExplanationsPanel — accordion list of code explanations.
 *
 * Each entry shows a title row with a chevron. Clicking a title expands
 * its body and collapses any other open entry. Only one entry can be
 * expanded at a time.
 *
 * A loading skeleton is shown at the top when an explain request is
 * in flight. An empty state is shown when no explanations exist.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExplanationEntry {
  id: string;
  title: string;
  explanation: string;
  phaseConnection?: string;
  timestamp: number;
}

interface ExplanationsPanelProps {
  explanations: ExplanationEntry[];
  loading: boolean;
  expandedId: string | null;
  onToggle: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
};

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-muted)',
  textAlign: 'center',
  padding: 'var(--space-md)',
};

const itemStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--border-subtle)',
};

const titleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: 'var(--space-xs) var(--space-md)',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  width: '100%',
  textAlign: 'left',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  fontWeight: 500,
  color: 'var(--text-primary)',
};

const chevronStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--text-muted)',
  flexShrink: 0,
  transition: 'transform 0.15s ease',
};

const titleTextStyle: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
};

const bodyStyle: React.CSSProperties = {
  padding: '0 var(--space-md) var(--space-sm)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-secondary)',
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
};

const phaseConnectionStyle: React.CSSProperties = {
  marginTop: 'var(--space-xs)',
  color: 'var(--text-muted)',
  fontStyle: 'italic',
};

// Skeleton styles
const skeletonItemStyle: React.CSSProperties = {
  padding: 'var(--space-xs) var(--space-md)',
  borderBottom: '1px solid var(--border-subtle)',
};

const skeletonBarBase: React.CSSProperties = {
  borderRadius: '4px',
  animation: 'skeleton-pulse 1.2s ease-in-out infinite',
};

const skeletonTitleStyle: React.CSSProperties = {
  ...skeletonBarBase,
  height: '14px',
  width: '60%',
  background: 'var(--bg-inset)',
};

const skeletonBodyStyle: React.CSSProperties = {
  ...skeletonBarBase,
  height: '48px',
  width: '100%',
  marginTop: 'var(--space-xs)',
  background: 'var(--bg-inset)',
};

// ---------------------------------------------------------------------------
// Skeleton keyframes injection
// ---------------------------------------------------------------------------

const SKELETON_STYLE_ID = 'paige-skeleton-pulse';

function ensureSkeletonStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SKELETON_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = SKELETON_STYLE_ID;
  style.textContent = `
    @keyframes skeleton-pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExplanationsPanel({
  explanations,
  loading,
  expandedId,
  onToggle,
}: ExplanationsPanelProps): React.ReactElement {
  ensureSkeletonStyles();

  // Empty state (no loading, no items)
  if (!loading && explanations.length === 0) {
    return <div style={emptyStateStyle}>Select code and click Explain</div>;
  }

  return (
    <div style={panelStyle}>
      {/* Loading skeleton */}
      {loading && (
        <div style={skeletonItemStyle}>
          <div style={skeletonTitleStyle} />
          <div style={skeletonBodyStyle} />
        </div>
      )}

      {/* Explanation items */}
      {explanations.map((entry) => {
        const isExpanded = expandedId === entry.id;
        return (
          <div key={entry.id} style={itemStyle}>
            <button
              type="button"
              style={titleRowStyle}
              onClick={() => onToggle(entry.id)}
              aria-expanded={isExpanded}
            >
              <span
                style={{
                  ...chevronStyle,
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
              >
                &#x25B6;
              </span>
              <span style={titleTextStyle}>{entry.title}</span>
            </button>
            {isExpanded && (
              <div style={bodyStyle}>
                {entry.explanation}
                {entry.phaseConnection && (
                  <div style={phaseConnectionStyle}>Phase connection: {entry.phaseConnection}</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
