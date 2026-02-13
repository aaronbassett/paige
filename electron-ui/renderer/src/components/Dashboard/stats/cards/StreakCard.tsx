import { AnimatedNumber } from '../shared/AnimatedNumber';
import { ChangeIndicator } from '../shared/ChangeIndicator';
import type { StatDefinition, StatPayload } from '../types';

function formatStreak(n: number): string {
  return `${n} day${n === 1 ? '' : 's'}`;
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};
const iconLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};
const labelStyle: React.CSSProperties = {
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-secondary)',
  lineHeight: 'var(--font-small-line-height)',
};
const valueStyle: React.CSSProperties = {
  fontSize: 'var(--font-h1-size)',
  color: 'var(--text-primary)',
  fontWeight: 700,
  margin: 'var(--space-sm) 0 0',
  lineHeight: 1.2,
};

export function StreakCard({ stat, data }: { stat: StatDefinition; data: StatPayload }) {
  const Icon = stat.icon;
  const value = typeof data.value === 'number' ? data.value : 0;
  const iconColor = value > 0 ? 'var(--accent-primary)' : 'var(--text-muted)';
  return (
    <>
      <div style={headerStyle}>
        <div style={iconLabelStyle}>
          <Icon size={16} color={iconColor} />
          <span style={labelStyle}>{stat.label}</span>
        </div>
        <ChangeIndicator change={data.change} />
      </div>
      <AnimatedNumber value={value} format={formatStreak} style={valueStyle} />
    </>
  );
}
