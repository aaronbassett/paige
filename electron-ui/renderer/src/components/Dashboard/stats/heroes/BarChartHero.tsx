import { ResponsiveBar } from '@nivo/bar';
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
const chartStyle: React.CSSProperties = { flex: 1, minHeight: 60 };
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

export function BarChartHero({ stat, data }: { stat: StatDefinition; data: StatPayload }) {
  const Icon = stat.icon;
  const isTall = stat.hero?.direction === 'tall';
  const breakdown = data.breakdown ?? [];

  const barData = breakdown.map(
    (b) =>
      ({
        category: b.label,
        amount: b.value,
      }) as Record<string, string | number>
  );

  const formatValue = (): ((n: number) => string) | undefined => {
    if (data.unit === 'currency') return (n: number) => `$${n.toFixed(2)}`;
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
      {barData.length > 0 && (
        <ResponsiveBar
          data={barData}
          keys={['amount']}
          indexBy="category"
          theme={nivoTheme}
          colors={[CHART_COLORS.primary]}
          layout={isTall ? 'horizontal' : 'vertical'}
          margin={
            isTall
              ? { top: 0, right: 8, bottom: 0, left: 60 }
              : { top: 0, right: 0, bottom: 24, left: 0 }
          }
          padding={0.3}
          borderRadius={3}
          enableGridX={false}
          enableGridY={false}
          enableLabel={false}
          axisLeft={isTall ? { tickSize: 0, tickPadding: 8 } : null}
          axisBottom={isTall ? null : { tickSize: 0, tickPadding: 4 }}
          axisTop={null}
          axisRight={null}
          isInteractive
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
