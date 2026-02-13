import { ResponsivePie } from '@nivo/pie';
import { AnimatedNumber } from '../shared/AnimatedNumber';
import { ChangeIndicator } from '../shared/ChangeIndicator';
import { nivoTheme, CHART_COLORS } from '../shared/nivoTheme';
import type { StatDefinition, StatPayload } from '../types';

const wideContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-md)',
  height: '100%',
};
const tallContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-md)',
  height: '100%',
};
const valueBlockStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  minWidth: '35%',
};
const chartStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 80,
  position: 'relative',
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

const HINT_COLORS = [CHART_COLORS.hintL1, CHART_COLORS.hintL2, CHART_COLORS.hintL3];

interface DonutDatum {
  id: string;
  value: number;
  color: string;
}

export function DonutHero({
  stat,
  data,
}: {
  stat: StatDefinition;
  data: StatPayload;
}) {
  const Icon = stat.icon;
  const isTall = stat.hero?.direction === 'tall';
  const breakdown = data.breakdown ?? [];
  const isHintLevel = stat.id === 'hint_level_breakdown';

  const pieData: DonutDatum[] = breakdown.map((b, i) => ({
    id: b.label,
    value: b.value,
    color: isHintLevel ? (HINT_COLORS[i] ?? CHART_COLORS.primary) : (b.color ?? CHART_COLORS.primary),
  }));

  const formatValue = (): ((n: number) => string) | undefined => {
    if (data.unit === 'duration') return (n: number) => `${Math.round(n)}m`;
    if (data.unit === 'percentage') return (n: number) => `${n.toFixed(1)}%`;
    return undefined;
  };

  const valueBlock = (
    <div style={valueBlockStyle}>
      <span style={labelStyle}>
        <Icon size={16} color="var(--text-muted)" />
        {stat.label}
      </span>
      <AnimatedNumber
        value={typeof data.value === 'number' ? data.value : 0}
        format={formatValue()}
        style={valueStyle}
      />
      <ChangeIndicator change={data.change} />
    </div>
  );

  const chart = (
    <div style={chartStyle}>
      {pieData.length > 0 && (
        <ResponsivePie
          data={pieData}
          theme={nivoTheme}
          colors={{ datum: 'data.color' }}
          innerRadius={0.6}
          padAngle={1.5}
          cornerRadius={3}
          margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
          enableArcLabels={false}
          enableArcLinkLabels={false}
          isInteractive
          activeOuterRadiusOffset={4}
        />
      )}
    </div>
  );

  return (
    <div style={isTall ? tallContainerStyle : wideContainerStyle}>
      {valueBlock}
      {chart}
    </div>
  );
}
