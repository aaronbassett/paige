import { AnimatedNumber } from '../shared/AnimatedNumber';
import { ChangeIndicator } from '../shared/ChangeIndicator';
import type { StatDefinition, StatPayload } from '../types';

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
const progressBarContainerStyle: React.CSSProperties = {
  height: '6px',
  borderRadius: '3px',
  backgroundColor: 'var(--bg-tertiary)',
  marginTop: 'var(--space-xs)',
  overflow: 'hidden',
};
const progressBarFillStyle = (pct: number): React.CSSProperties => ({
  height: '100%',
  width: `${pct}%`,
  backgroundColor: 'var(--accent-primary)',
  borderRadius: '3px',
  transition: 'width 0.4s ease',
});

export function KataCard({ stat, data }: { stat: StatDefinition; data: StatPayload }) {
  const Icon = stat.icon;
  const completed = typeof data.value === 'number' ? data.value : 0;
  const total = data.breakdown?.[0]?.value ?? 0;
  const pct = total > 0 ? (completed / total) * 100 : 0;

  const formatFraction = (n: number): string => `${n}/${total}`;

  return (
    <>
      <div style={headerStyle}>
        <div style={iconLabelStyle}>
          <Icon size={16} color="var(--text-muted)" />
          <span style={labelStyle}>{stat.label}</span>
        </div>
        <ChangeIndicator change={data.change} />
      </div>
      <AnimatedNumber value={completed} format={formatFraction} style={valueStyle} />
      <div style={progressBarContainerStyle}>
        <div style={progressBarFillStyle(pct)} />
      </div>
    </>
  );
}
