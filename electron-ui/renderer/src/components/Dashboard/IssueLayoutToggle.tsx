/**
 * IssueLayoutToggle -- Three SVG icon buttons for switching issue card layouts.
 *
 * Modes:
 *   - full:      2x2 grid icon (large cards)
 *   - condensed: 3-row condensed grid icon
 *   - list:      horizontal lines (list rows)
 *
 * Active mode is highlighted with the accent color.
 */

import type { IssueLayoutMode } from './IssueCard';

interface IssueLayoutToggleProps {
  current: IssueLayoutMode;
  onChange: (mode: IssueLayoutMode) => void;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  background: 'var(--bg-surface)',
  borderRadius: '6px',
  padding: '2px',
};

const buttonStyle = (isActive: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  borderRadius: '4px',
  border: 'none',
  background: isActive ? 'var(--accent-primary)' : 'transparent',
  color: isActive ? 'var(--bg-surface)' : 'var(--text-muted)',
  cursor: 'pointer',
  transition: 'background 0.15s ease, color 0.15s ease',
  padding: 0,
});

// ---------------------------------------------------------------------------
// Icon SVGs
// ---------------------------------------------------------------------------

/** 2x2 grid icon representing full card layout. */
function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  );
}

/** 3 horizontal bars with small squares, representing condensed grid layout. */
function CondensedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="1" y="1" width="14" height="3.5" rx="1" />
      <rect x="1" y="6.25" width="14" height="3.5" rx="1" />
      <rect x="1" y="11.5" width="14" height="3.5" rx="1" />
    </svg>
  );
}

/** Horizontal lines representing list layout. */
function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="1" y="2" width="14" height="2" rx="0.5" />
      <rect x="1" y="5.5" width="10" height="2" rx="0.5" />
      <rect x="1" y="9" width="14" height="2" rx="0.5" />
      <rect x="1" y="12.5" width="10" height="2" rx="0.5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const modes: Array<{ mode: IssueLayoutMode; label: string; Icon: React.FC }> = [
  { mode: 'full', label: 'Grid view', Icon: GridIcon },
  { mode: 'condensed', label: 'Condensed view', Icon: CondensedIcon },
  { mode: 'list', label: 'List view', Icon: ListIcon },
];

export function IssueLayoutToggle({ current, onChange }: IssueLayoutToggleProps) {
  return (
    <div style={containerStyle} role="radiogroup" aria-label="Issue layout">
      {modes.map(({ mode, label, Icon }) => (
        <button
          key={mode}
          type="button"
          style={buttonStyle(current === mode)}
          onClick={() => onChange(mode)}
          aria-label={label}
          aria-checked={current === mode}
          role="radio"
          title={label}
        >
          <Icon />
        </button>
      ))}
    </div>
  );
}
