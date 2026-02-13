import { ResponsiveLine } from '@nivo/line';
import { AnimatedNumber } from '../shared/AnimatedNumber';
import { ChangeIndicator } from '../shared/ChangeIndicator';
import { nivoTheme, CHART_COLORS } from '../shared/nivoTheme';
import type { StatDefinition, StatPayload } from '../types';

const containerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-md)',
  height: '100%',
};
const leftStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  minWidth: '35%',
};
const rightStyle: React.CSSProperties = { flex: 1, minHeight: 60 };
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

export function SparklineHero({
  stat,
  data,
}: {
  stat: StatDefinition;
  data: StatPayload;
}) {
  const Icon = stat.icon;
  const points = data.sparkline ?? [];
  const lineData = [
    {
      id: stat.id,
      data: points.map((p) => ({ x: p.x, y: p.y })),
    },
  ];

  return (
    <div style={containerStyle}>
      <div style={leftStyle}>
        <span style={labelStyle}>
          <Icon size={16} color="var(--text-muted)" />
          {stat.label}
        </span>
        <AnimatedNumber
          value={typeof data.value === 'number' ? data.value : 0}
          format={
            data.unit === 'percentage'
              ? (n: number) => `${n.toFixed(1)}%`
              : undefined
          }
          style={valueStyle}
        />
        <ChangeIndicator change={data.change} />
      </div>
      <div style={rightStyle}>
        {points.length > 1 && (
          <ResponsiveLine
            data={lineData}
            theme={nivoTheme}
            colors={[CHART_COLORS.primary]}
            enableArea
            areaOpacity={0.1}
            enableGridX={false}
            enableGridY={false}
            enablePoints={false}
            axisLeft={null}
            axisBottom={null}
            margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
            curve="monotoneX"
            isInteractive
            enableCrosshair={false}
          />
        )}
      </div>
    </div>
  );
}
