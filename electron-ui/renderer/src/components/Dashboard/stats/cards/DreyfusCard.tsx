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
const valueContainerStyle: React.CSSProperties = {
  margin: 'var(--space-sm) 0 0',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
};
const pillStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '4px 12px',
  borderRadius: '12px',
  backgroundColor: 'color-mix(in srgb, var(--accent-primary) 15%, transparent)',
  color: 'var(--accent-primary)',
  fontSize: 'var(--font-h2-size)',
  fontWeight: 700,
  lineHeight: 1.2,
};

export function DreyfusCard({ stat, data }: { stat: StatDefinition; data: StatPayload }) {
  const Icon = stat.icon;
  const levelName = typeof data.value === 'string' ? data.value : String(data.value);
  return (
    <>
      <div style={headerStyle}>
        <div style={iconLabelStyle}>
          <Icon size={16} color="var(--text-muted)" />
          <span style={labelStyle}>{stat.label}</span>
        </div>
        <ChangeIndicator change={data.change} />
      </div>
      <div style={valueContainerStyle}>
        <span style={pillStyle}>{levelName}</span>
      </div>
    </>
  );
}
