/**
 * StatsBento — 6-card bento grid showing coding statistics with a period switcher.
 *
 * Renders a 3x2 grid of stat cards, each showing a label, large numeric value,
 * and a directional change indicator. A three-button period switcher (Today /
 * This Week / This Month) lets the user toggle the time window.
 *
 * States:
 *   - Loading (stats === null): 6 pulsing skeleton cards
 *   - Empty (all values are 0): "Start coding" prompt
 *   - Ready: populated stat cards with change indicators
 */

import { useMemo } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StatsPeriod = 'today' | 'this_week' | 'this_month';

interface StatsBentoProps {
  stats: {
    period: StatsPeriod;
    stats: Array<{ label: string; value: number; change: number }>;
  } | null;
  onPeriodChange: (period: StatsPeriod) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PERIODS: Array<{ key: StatsPeriod; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
];

const SKELETON_COUNT = 6;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  padding: 'var(--space-md)',
  borderRadius: '8px',
};

const headerStyle: React.CSSProperties = {
  fontSize: '18px',
};

const switcherContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-md)',
  marginBottom: 'var(--space-md)',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 'var(--space-sm)',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  borderRadius: '6px',
  padding: 'var(--space-md)',
};

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-secondary)',
  margin: 0,
  lineHeight: 'var(--font-small-line-height)',
};

const valueStyle: React.CSSProperties = {
  fontSize: 'var(--font-h2-size)',
  color: 'var(--text-primary)',
  fontWeight: 700,
  margin: 'var(--space-xs) 0',
  lineHeight: 'var(--font-h2-line-height)',
};

const skeletonBarStyle: React.CSSProperties = {
  background: 'var(--border-subtle)',
  borderRadius: '4px',
};

const emptyStateStyle: React.CSSProperties = {
  gridColumn: '1 / -1',
  textAlign: 'center',
  padding: 'var(--space-xl) var(--space-md)',
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PeriodSwitcher({
  activePeriod,
  onPeriodChange,
}: {
  activePeriod: StatsPeriod;
  onPeriodChange: (period: StatsPeriod) => void;
}) {
  return (
    <div style={switcherContainerStyle} role="tablist" aria-label="Statistics period">
      {PERIODS.map(({ key, label }) => {
        const isActive = key === activePeriod;
        const buttonStyle: React.CSSProperties = {
          background: 'none',
          border: 'none',
          borderBottom: isActive ? '2px solid var(--border-active)' : '2px solid transparent',
          color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
          fontFamily: 'var(--font-family)',
          fontSize: 'var(--font-small-size)',
          cursor: 'pointer',
          padding: 'var(--space-xs) var(--space-sm)',
          lineHeight: 'var(--font-small-line-height)',
        };

        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isActive}
            style={buttonStyle}
            onClick={() => onPeriodChange(key)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function ChangeIndicator({ change }: { change: number }) {
  if (change === 0) {
    const style: React.CSSProperties = {
      fontSize: 'var(--font-small-size)',
      color: 'var(--text-muted)',
    };
    return <span style={style}>&mdash;</span>;
  }

  const isPositive = change > 0;
  const arrow = isPositive ? '\u2191' : '\u2193';
  const color = isPositive ? 'var(--status-success)' : 'var(--status-error)';
  const style: React.CSSProperties = {
    fontSize: 'var(--font-small-size)',
    color,
  };

  return (
    <span style={style}>
      {arrow} {Math.abs(change)}%
    </span>
  );
}

function StatCard({ label, value, change }: { label: string; value: number; change: number }) {
  return (
    <div style={cardStyle}>
      <p style={labelStyle}>{label}</p>
      <p style={valueStyle}>{value.toLocaleString()}</p>
      <ChangeIndicator change={change} />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={cardStyle} aria-hidden="true">
      <div
        style={{
          ...skeletonBarStyle,
          width: '60%',
          height: '12px',
          marginBottom: 'var(--space-sm)',
          animation: 'breathe 2s ease-in-out infinite',
        }}
      />
      <div
        style={{
          ...skeletonBarStyle,
          width: '40%',
          height: '24px',
          marginBottom: 'var(--space-sm)',
          animation: 'breathe 2s ease-in-out infinite 0.1s',
        }}
      />
      <div
        style={{
          ...skeletonBarStyle,
          width: '30%',
          height: '12px',
          animation: 'breathe 2s ease-in-out infinite 0.2s',
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StatsBento({ stats, onPeriodChange }: StatsBentoProps) {
  const activePeriod: StatsPeriod = stats?.period ?? 'this_week';

  const allZero = useMemo(() => {
    if (stats === null) return false;
    return stats.stats.length === 0 || stats.stats.every((s) => s.value === 0);
  }, [stats]);

  const isLoading = stats === null;

  return (
    <section style={containerStyle} aria-label="Coding statistics">
      <pre className="figlet-header" style={headerStyle}>
        STATS
      </pre>

      <PeriodSwitcher activePeriod={activePeriod} onPeriodChange={onPeriodChange} />

      <div style={gridStyle} role={isLoading ? 'status' : undefined} aria-busy={isLoading}>
        {isLoading ? (
          Array.from({ length: SKELETON_COUNT }, (_, i) => <SkeletonCard key={i} />)
        ) : allZero ? (
          <p style={emptyStateStyle}>Start coding to see your stats!</p>
        ) : (
          stats.stats.map((stat) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} change={stat.change} />
          ))
        )}
      </div>
    </section>
  );
}
