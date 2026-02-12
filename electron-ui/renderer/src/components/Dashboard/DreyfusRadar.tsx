/**
 * DreyfusRadar -- SVG spider/radar chart showing Dreyfus model skill levels.
 *
 * Renders a polygonal radar chart for 3+ axes, or falls back to a horizontal
 * bar chart when there are fewer than 3 data points (spider charts degenerate
 * with 1-2 axes).
 *
 * Levels follow the Dreyfus model:
 *   1 = Novice, 2 = Advanced Beginner, 3 = Competent, 4 = Proficient, 5 = Expert
 */

interface DreyfusRadarProps {
  axes: Array<{ skill: string; level: 1 | 2 | 3 | 4 | 5 }> | null;
}

/** Human-readable labels for each Dreyfus level. */
const LEVEL_LABELS: Record<number, string> = {
  1: 'Novice',
  2: 'Adv. Beginner',
  3: 'Competent',
  4: 'Proficient',
  5: 'Expert',
};

const MAX_LEVEL = 5;

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  padding: 'var(--space-md)',
  borderRadius: '8px',
};

const headerStyle: React.CSSProperties = {
  fontSize: 'var(--font-small-size)',
  margin: 0,
  marginBottom: 'var(--space-sm)',
  lineHeight: 1.1,
};

const emptyTextStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
  textAlign: 'center',
  padding: 'var(--space-lg) 0',
};

// ---------------------------------------------------------------------------
// Skeleton loading state
// ---------------------------------------------------------------------------

const skeletonBarStyle: React.CSSProperties = {
  background: 'var(--border-subtle)',
  borderRadius: '4px',
  animation: 'breathe 2s ease-in-out infinite',
};

function SkeletonPlaceholder(): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
        padding: 'var(--space-md) 0',
      }}
      aria-hidden="true"
    >
      <div style={{ ...skeletonBarStyle, width: '80%', height: '12px' }} />
      <div style={{ ...skeletonBarStyle, width: '60%', height: '12px' }} />
      <div style={{ ...skeletonBarStyle, width: '90%', height: '12px' }} />
      <div style={{ ...skeletonBarStyle, width: '50%', height: '12px' }} />
      <div style={{ ...skeletonBarStyle, width: '70%', height: '12px' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bar chart fallback (1-2 axes)
// ---------------------------------------------------------------------------

interface BarChartProps {
  axes: Array<{ skill: string; level: 1 | 2 | 3 | 4 | 5 }>;
}

function BarChartFallback({ axes }: BarChartProps): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
        padding: 'var(--space-sm) 0',
      }}
      role="img"
      aria-label={`Skill levels: ${axes.map((a) => `${a.skill} level ${a.level}`).join(', ')}`}
    >
      {axes.map((axis) => (
        <div key={axis.skill}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 'var(--space-xs)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-family)',
                fontSize: 'var(--font-small-size)',
                color: 'var(--text-secondary)',
              }}
            >
              {axis.skill}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-family)',
                fontSize: 'var(--font-small-size)',
                color: 'var(--text-muted)',
              }}
            >
              {LEVEL_LABELS[axis.level]}
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: '8px',
              background: 'var(--border-subtle)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${(axis.level / MAX_LEVEL) * 100}%`,
                height: '100%',
                background: 'var(--accent-primary)',
                borderRadius: '4px',
                transition: 'width 300ms ease-out',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spider / Radar chart (3+ axes)
// ---------------------------------------------------------------------------

interface SpiderChartProps {
  axes: Array<{ skill: string; level: 1 | 2 | 3 | 4 | 5 }>;
}

/**
 * Compute (x, y) for a point on the radar chart.
 * Angle 0 is straight up (12-o'clock), going clockwise.
 */
function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleIndex: number,
  totalAxes: number
): { x: number; y: number } {
  const angleRad = (2 * Math.PI * angleIndex) / totalAxes - Math.PI / 2;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

function SpiderChart({ axes }: SpiderChartProps): React.JSX.Element {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size / 2 - 36; // leave room for labels
  const axisCount = axes.length;

  /** Build SVG points string for a polygon at a given level. */
  const buildPolygonPoints = (levelValues: number[]): string => {
    return levelValues
      .map((val, i) => {
        const r = (val / MAX_LEVEL) * maxRadius;
        const { x, y } = polarToCartesian(cx, cy, r, i, axisCount);
        return `${x},${y}`;
      })
      .join(' ');
  };

  // Grid polygons at each level (1-5)
  const gridLevels = [1, 2, 3, 4, 5];

  // Data polygon
  const dataPoints = buildPolygonPoints(axes.map((a) => a.level));

  // Accessible description
  const ariaLabel = `Radar chart showing skill levels: ${axes.map((a) => `${a.skill} at level ${a.level} (${LEVEL_LABELS[a.level]})`).join(', ')}`;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      style={{ maxWidth: `${size}px`, display: 'block', margin: '0 auto' }}
      role="img"
      aria-label={ariaLabel}
    >
      {/* Grid polygons */}
      {gridLevels.map((level) => {
        const pts = buildPolygonPoints(Array.from({ length: axisCount }, () => level));
        return (
          <polygon
            key={`grid-${level}`}
            points={pts}
            fill="none"
            stroke="var(--border-subtle)"
            strokeWidth="1"
          />
        );
      })}

      {/* Axis lines from center to perimeter */}
      {axes.map((_, i) => {
        const { x, y } = polarToCartesian(cx, cy, maxRadius, i, axisCount);
        return (
          <line
            key={`axis-${i}`}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="var(--border-subtle)"
            strokeWidth="1"
          />
        );
      })}

      {/* Data polygon fill + stroke */}
      <polygon
        points={dataPoints}
        fill="var(--accent-primary)"
        fillOpacity={0.3}
        stroke="var(--accent-primary)"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Data point dots */}
      {axes.map((axis, i) => {
        const r = (axis.level / MAX_LEVEL) * maxRadius;
        const { x, y } = polarToCartesian(cx, cy, r, i, axisCount);
        return <circle key={`dot-${i}`} cx={x} cy={y} r="3" fill="var(--accent-primary)" />;
      })}

      {/* Axis labels */}
      {axes.map((axis, i) => {
        const labelRadius = maxRadius + 16;
        const { x, y } = polarToCartesian(cx, cy, labelRadius, i, axisCount);

        // Determine text-anchor based on position relative to center
        const angle = (2 * Math.PI * i) / axisCount - Math.PI / 2;
        const cos = Math.cos(angle);
        let textAnchor: 'start' | 'middle' | 'end' = 'middle';
        if (cos > 0.1) textAnchor = 'start';
        else if (cos < -0.1) textAnchor = 'end';

        // Nudge vertically when label is near top/bottom
        const sin = Math.sin(angle);
        const dy = sin > 0.5 ? '0.8em' : sin < -0.5 ? '-0.2em' : '0.35em';

        return (
          <text
            key={`label-${i}`}
            x={x}
            y={y}
            textAnchor={textAnchor}
            dy={dy}
            fill="var(--text-secondary)"
            fontFamily="var(--font-family)"
            fontSize="11"
          >
            {axis.skill}
          </text>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DreyfusRadar({ axes }: DreyfusRadarProps): React.JSX.Element {
  return (
    <section style={containerStyle} aria-label="Dreyfus skill radar">
      <pre className="figlet-header" style={headerStyle}>
        SKILLS
      </pre>

      {/* Loading: axes is null */}
      {axes === null && <SkeletonPlaceholder />}

      {/* Empty: axes is an empty array */}
      {axes !== null && axes.length === 0 && <p style={emptyTextStyle}>No skill data yet</p>}

      {/* Bar chart fallback: 1-2 axes */}
      {axes !== null && axes.length >= 1 && axes.length <= 2 && <BarChartFallback axes={axes} />}

      {/* Spider chart: 3+ axes */}
      {axes !== null && axes.length >= 3 && <SpiderChart axes={axes} />}
    </section>
  );
}
