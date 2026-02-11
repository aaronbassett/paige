/**
 * LearningMaterials -- Dashboard section showing recommended learning
 * materials (articles, videos, tutorials).
 *
 * Each material card displays a monospace type badge (DOC / VID / TUT)
 * and a title. Clicking a card calls onMaterialClick to navigate to
 * a placeholder view.
 *
 * States:
 *   - Loading (materials === null): 2 pulsing skeleton placeholders
 *   - Empty (materials is []): "No materials available" message
 *   - Ready: scrollable list of material cards with hover effect
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LearningMaterialsProps {
  materials: Array<{
    id: string;
    title: string;
    type: 'article' | 'video' | 'tutorial';
    url: string;
  }> | null;
  onMaterialClick: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SKELETON_COUNT = 2;

/** Badge text and color for each material type. */
const TYPE_BADGE_CONFIG: Record<
  'article' | 'video' | 'tutorial',
  { label: string; color: string }
> = {
  article: { label: 'DOC', color: 'var(--status-info)' },
  video: { label: 'VID', color: 'var(--accent-primary)' },
  tutorial: { label: 'TUT', color: 'var(--status-success)' },
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  padding: 'var(--space-md)',
  borderRadius: '8px',
};

const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-sm)',
};

const cardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
  padding: 'var(--space-sm) var(--space-md)',
  borderRadius: '6px',
  border: '1px solid var(--border-subtle)',
  cursor: 'pointer',
  transition: 'background 0.15s ease',
};

const badgeStyle = (color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '4px',
  padding: '2px 6px',
  fontSize: 'var(--font-small-size)',
  fontWeight: 600,
  fontFamily: 'var(--font-family), monospace',
  color,
  border: `1px solid ${color}`,
  background: 'transparent',
  flexShrink: 0,
  lineHeight: 1.4,
});

const titleStyle: React.CSSProperties = {
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
  minWidth: 0,
};

const skeletonCardStyle: React.CSSProperties = {
  ...cardStyle,
  cursor: 'default',
  height: '40px',
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

export function LearningMaterials({ materials, onMaterialClick }: LearningMaterialsProps) {
  return (
    <div style={containerStyle}>
      <pre className="figlet-header" style={{ fontSize: '18px' }}>
        MATERIALS
      </pre>

      {/* Loading state: skeleton placeholders */}
      {materials === null && (
        <div style={listStyle}>
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <div key={i} style={skeletonCardStyle} aria-hidden="true" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {materials !== null && materials.length === 0 && (
        <p style={emptyStyle}>No materials available</p>
      )}

      {/* Populated state */}
      {materials !== null && materials.length > 0 && (
        <div style={listStyle}>
          {materials.map((material) => {
            const config = TYPE_BADGE_CONFIG[material.type];

            return (
              <div
                key={material.id}
                style={cardStyle}
                onClick={() => onMaterialClick()}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    'var(--bg-elevated)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = '';
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onMaterialClick();
                  }
                }}
                aria-label={`${config.label}: ${material.title}`}
              >
                <span style={badgeStyle(config.color)}>{config.label}</span>
                <p style={titleStyle} title={material.title}>
                  {material.title}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
