/**
 * StatsBento -- Bento grid (4-col, 2-row) showing coding statistics.
 *
 * Renders up to 8 cells of StatCard components with LayoutGroup/AnimatePresence
 * for animated layout transitions. Integrates StatsControls for date-range
 * dropdown and filter popover. Some cards are promoted to "hero" size (2 cells)
 * based on randomized selection that changes with period and filter.
 *
 * States:
 *   - Loading (stats === null): 8 pulsing skeleton cards
 *   - Empty (all values are 0): "Start coding" prompt
 *   - Ready: populated stat cards with hero promotions
 */

import { useMemo } from 'react';
import { LayoutGroup, AnimatePresence } from 'framer-motion';
import { useStatsFilter } from './stats/hooks/useStatsFilter';
import { useHeroSelection } from './stats/hooks/useHeroSelection';
import { StatsControls } from './stats/StatsControls';
import { StatCard } from './stats/StatCard';
import { STATS_BY_ID } from './stats/catalog';
import type { StatsPeriod, DashboardStatsPayload, StatId } from './stats/types';

interface StatsBentoProps {
  stats: DashboardStatsPayload | null;
  onPeriodChange: (period: StatsPeriod) => void;
}

const containerStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  padding: 'var(--space-md)',
  borderRadius: '8px',
};

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 'var(--space-md)',
};

const headerStyle: React.CSSProperties = { fontSize: '18px', margin: 0 };

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gridTemplateRows: 'repeat(2, 1fr)',
  gap: 'var(--space-sm)',
};

const emptyStateStyle: React.CSSProperties = {
  gridColumn: '1 / -1',
  gridRow: '1 / -1',
  textAlign: 'center',
  padding: 'var(--space-xl) var(--space-md)',
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-body-size)',
};

export function StatsBento({ stats, onPeriodChange }: StatsBentoProps) {
  const { activeStats, toggle, reset, isAtLimit } = useStatsFilter();
  const period: StatsPeriod = stats?.period ?? 'last_month';

  // Seed for hero randomization -- changes on period + filter changes
  const heroSeed = useMemo(() => `${period}-${activeStats.join(',')}`, [period, activeStats]);
  const heroSet = useHeroSelection(activeStats, heroSeed);

  // Compute which stats fit in the 4x2 grid (8 cells)
  const visibleStats = useMemo(() => {
    let cellsUsed = 0;
    const visible: Array<{ id: StatId; isHero: boolean }> = [];
    for (const id of activeStats) {
      const isHero = heroSet.has(id);
      const stat = STATS_BY_ID.get(id);
      const cells =
        isHero && stat?.hero
          ? 2 // both hero types take 2 cells
          : 1;
      if (cellsUsed + cells > 8) break;
      visible.push({ id, isHero });
      cellsUsed += cells;
    }
    return visible;
  }, [activeStats, heroSet]);

  const isLoading = stats === null;
  const allZero =
    stats !== null && Object.values(stats.stats).every((s) => s.value === 0);

  return (
    <section style={containerStyle} aria-label="Coding statistics">
      <div style={headerRowStyle}>
        <pre className="figlet-header" style={headerStyle}>
          STATS
        </pre>
        <StatsControls
          period={period}
          onPeriodChange={onPeriodChange}
          activeStats={activeStats}
          onToggle={toggle}
          onReset={reset}
          isAtLimit={isAtLimit}
        />
      </div>

      <LayoutGroup>
        <div style={gridStyle}>
          <AnimatePresence mode="popLayout">
            {isLoading ? (
              // Skeleton placeholder cards
              Array.from({ length: 8 }, (_, i) => (
                <div
                  key={`skeleton-${i}`}
                  style={{
                    background: 'var(--bg-elevated)',
                    borderRadius: '8px',
                    padding: 'var(--space-md)',
                    animation: 'breathe 2s ease-in-out infinite',
                  }}
                />
              ))
            ) : allZero ? (
              <p key="empty" style={emptyStateStyle}>
                Start coding to see your stats!
              </p>
            ) : (
              visibleStats.map(({ id, isHero }, index) => {
                const data = stats.stats[id];
                if (!data) return null;
                return (
                  <StatCard key={id} statId={id} data={data} isHero={isHero} index={index} />
                );
              })
            )}
          </AnimatePresence>
        </div>
      </LayoutGroup>
    </section>
  );
}
