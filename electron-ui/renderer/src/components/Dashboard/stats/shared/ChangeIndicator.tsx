const upStyle: React.CSSProperties = { fontSize: 'var(--font-small-size)', color: 'var(--status-success)' };
const downStyle: React.CSSProperties = { fontSize: 'var(--font-small-size)', color: 'var(--status-error)' };
const flatStyle: React.CSSProperties = { fontSize: 'var(--font-small-size)', color: 'var(--text-muted)' };

export function ChangeIndicator({ change }: { change: number }) {
  if (change === 0) return <span style={flatStyle}>&mdash;</span>;
  const isPositive = change > 0;
  const arrow = isPositive ? '\u2191' : '\u2193';
  return (
    <span style={isPositive ? upStyle : downStyle}>
      {arrow} {Math.abs(change).toFixed(1)}%
    </span>
  );
}
