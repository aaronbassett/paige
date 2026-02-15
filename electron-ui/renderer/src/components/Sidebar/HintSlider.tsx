/**
 * HintSlider -- 4-position discrete slider for coaching hint level.
 *
 * Renders an ASCII progress bar [====..........] with 4 clickable zones,
 * a centered level name below, and a description below that.
 *
 * Levels:
 *   0 = None   (student working alone)
 *   1 = Light  (subtle guidance)
 *   2 = Medium (directed coaching)
 *   3 = Heavy  (hand-holding)
 */

import { useCallback } from 'react';
import type { HintLevel } from '@shared/types/entities';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HintSliderProps {
  level: HintLevel;
  onChange: (level: HintLevel) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEVELS: Array<{ value: HintLevel; label: string }> = [
  { value: 0, label: 'None' },
  { value: 1, label: 'Light' },
  { value: 2, label: 'Medium' },
  { value: 3, label: 'Heavy' },
];

const LEVEL_DESCRIPTIONS: Record<HintLevel, string> = {
  0: 'No coaching hints',
  1: 'Subtle nudges only',
  2: 'Guided directions',
  3: 'Detailed walkthroughs',
};

const TOTAL_CHARS = 14;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildBar(level: HintLevel): string {
  const fillCount = Math.round((level / 3) * TOTAL_CHARS);
  return '[' + '='.repeat(fillCount) + '\u00B7'.repeat(TOTAL_CHARS - fillCount) + ']';
}

/**
 * Given a click position (0-based character index within the bar content,
 * excluding the brackets), returns the corresponding hint level (0-3).
 */
function charIndexToLevel(charIndex: number): HintLevel {
  const zoneSize = TOTAL_CHARS / 4;
  const raw = Math.floor(charIndex / zoneSize);
  return Math.min(3, Math.max(0, raw)) as HintLevel;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--space-sm)',
  padding: 'var(--space-md)',
  fontFamily: 'var(--font-family)',
};

const barStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '18px',
  lineHeight: 1,
  color: 'var(--accent-primary)',
  cursor: 'pointer',
  userSelect: 'none',
  margin: 0,
  letterSpacing: '1px',
};

const descriptionStyle: React.CSSProperties = {
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-muted)',
  margin: 0,
  textAlign: 'center',
  minHeight: '1.4em',
  transition: 'opacity 0.2s ease',
};

const labelsContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  width: '100%',
  maxWidth: '240px',
  paddingLeft: '0',
  paddingRight: '0',
};

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--font-label-size)',
  color: 'var(--text-secondary)',
  textAlign: 'center',
  width: '60px',
  cursor: 'pointer',
  userSelect: 'none',
  transition: 'color 0.2s ease',
};

const activeLabelStyle: React.CSSProperties = {
  ...labelStyle,
  color: 'var(--accent-primary)',
  fontWeight: 600,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function HintSlider({ level, onChange }: HintSliderProps) {
  const handleLevelClick = useCallback(
    (newLevel: HintLevel) => {
      if (newLevel !== level) {
        onChange(newLevel);
      }
    },
    [level, onChange]
  );

  const handleBarClick = useCallback(
    (e: React.MouseEvent<HTMLPreElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const charWidth = rect.width / (TOTAL_CHARS + 2); // +2 for brackets
      const charIndex = Math.floor(x / charWidth) - 1; // -1 for opening bracket
      if (charIndex < 0 || charIndex >= TOTAL_CHARS) return;
      const newLevel = charIndexToLevel(charIndex);
      if (newLevel !== level) {
        onChange(newLevel);
      }
    },
    [level, onChange]
  );

  const activeConfig = LEVELS[level]!;
  const bar = buildBar(level);

  return (
    <div style={containerStyle} role="group" aria-label="Hint level selector">
      {/* ASCII progress bar */}
      <pre
        style={barStyle}
        onClick={handleBarClick}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={3}
        aria-valuenow={level}
        aria-valuetext={`${activeConfig.label} - ${LEVEL_DESCRIPTIONS[level]}`}
        aria-label="Hint level"
        tabIndex={0}
        data-testid="hint-bar"
      >
        {bar}
      </pre>

      {/* Level name */}
      <p style={{ ...descriptionStyle, fontWeight: 600, color: 'var(--accent-primary)' }}>
        {activeConfig.label}
      </p>

      {/* Description */}
      <p style={descriptionStyle} aria-live="polite">
        {LEVEL_DESCRIPTIONS[level]}
      </p>

      {/* Labels */}
      <div style={labelsContainerStyle}>
        {LEVELS.map(({ value, label }) => (
          <span
            key={value}
            style={value === level ? activeLabelStyle : labelStyle}
            onClick={() => handleLevelClick(value)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleLevelClick(value);
              }
            }}
            data-testid={`hint-label-${value}`}
            data-active={value === level}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
