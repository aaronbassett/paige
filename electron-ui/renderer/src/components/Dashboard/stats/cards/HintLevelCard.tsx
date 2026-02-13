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
const barContainerStyle: React.CSSProperties = {
  display: 'flex',
  height: '24px',
  borderRadius: '6px',
  overflow: 'hidden',
  margin: 'var(--space-sm) 0 0',
};
const legendStyle: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-sm)',
  marginTop: 'var(--space-xs)',
};
const legendItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-muted)',
};
const legendDotStyle = (color: string): React.CSSProperties => ({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: color,
});

const LEVEL_COLORS = ['var(--status-success)', 'var(--status-warning)', 'var(--status-error)'];

export function HintLevelCard({ stat, data }: { stat: StatDefinition; data: StatPayload }) {
  const Icon = stat.icon;
  const breakdown = data.breakdown ?? [];
  const total = breakdown.reduce((sum, item) => sum + item.value, 0);

  return (
    <>
      <div style={headerStyle}>
        <div style={iconLabelStyle}>
          <Icon size={16} color="var(--text-muted)" />
          <span style={labelStyle}>{stat.label}</span>
        </div>
        <ChangeIndicator change={data.change} />
      </div>
      <div style={barContainerStyle}>
        {breakdown.map((item, i) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <div
              key={item.label}
              style={{
                width: `${pct}%`,
                backgroundColor: item.color ?? LEVEL_COLORS[i] ?? 'var(--text-muted)',
                transition: 'width 0.4s ease',
              }}
            />
          );
        })}
      </div>
      <div style={legendStyle}>
        {breakdown.map((item, i) => (
          <div key={item.label} style={legendItemStyle}>
            <div style={legendDotStyle(item.color ?? LEVEL_COLORS[i] ?? 'var(--text-muted)')} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </>
  );
}
