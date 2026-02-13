import type { PartialTheme } from '@nivo/theming';

export const nivoTheme: PartialTheme = {
  text: { fill: '#a8a69e' }, // --text-secondary
  grid: { line: { stroke: '#30302e' } }, // --border-subtle
  tooltip: {
    container: {
      background: '#252523', // --bg-surface
      color: '#faf9f5', // --text-primary
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '12px',
      borderRadius: '6px',
      padding: '8px 12px',
    },
  },
  axis: {
    ticks: { text: { fill: '#6b6960' } }, // --text-muted
  },
};

export const CHART_COLORS = {
  primary: '#d97757', // --accent-primary
  primaryArea: 'rgba(217, 119, 87, 0.1)',
  hintL1: '#7cb87c', // --status-success
  hintL2: '#d4a843', // --status-warning
  hintL3: '#e05252', // --status-error
} as const;
