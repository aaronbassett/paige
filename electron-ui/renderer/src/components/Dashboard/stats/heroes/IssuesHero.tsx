import { AnimatedNumber } from '../shared/AnimatedNumber';
import { ChangeIndicator } from '../shared/ChangeIndicator';
import type { StatDefinition, StatPayload } from '../types';

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-md)',
  height: '100%',
};
const headerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
};
const labelStyle: React.CSSProperties = {
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-secondary)',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};
const valueStyle: React.CSSProperties = {
  fontSize: 'var(--font-display-size)',
  color: 'var(--text-primary)',
  fontWeight: 700,
  lineHeight: 1.2,
};
const pillsContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
  flex: 1,
  alignContent: 'flex-start',
  overflow: 'hidden',
};

function hexToRgba(hex: string, alpha: number): string {
  const stripped = hex.replace('#', '');
  const r = parseInt(stripped.substring(0, 2), 16);
  const g = parseInt(stripped.substring(2, 4), 16);
  const b = parseInt(stripped.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function Pill({ label, color, count }: { label: string; color: string; count: number }) {
  const pillStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: 'var(--font-small-size)',
    backgroundColor: hexToRgba(color, 0.2),
    color,
    fontWeight: 500,
    whiteSpace: 'nowrap',
  };
  const badgeStyle: React.CSSProperties = {
    backgroundColor: hexToRgba(color, 0.3),
    borderRadius: '8px',
    padding: '0 5px',
    fontSize: '11px',
    fontWeight: 600,
    minWidth: '18px',
    textAlign: 'center',
  };

  return (
    <span style={pillStyle}>
      {label}
      <span style={badgeStyle}>{count}</span>
    </span>
  );
}

export function IssuesHero({ stat, data }: { stat: StatDefinition; data: StatPayload }) {
  const Icon = stat.icon;
  const pills = data.pills ?? [];

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={labelStyle}>
          <Icon size={16} color="var(--text-muted)" />
          {stat.label}
        </span>
        <AnimatedNumber
          value={typeof data.value === 'number' ? data.value : 0}
          style={valueStyle}
        />
        <ChangeIndicator change={data.change} />
      </div>
      <div style={pillsContainerStyle}>
        {pills.map((pill) => (
          <Pill key={pill.label} label={pill.label} color={pill.color} count={pill.count} />
        ))}
      </div>
    </div>
  );
}
