/**
 * HintSlider -- 4-position discrete slider for coaching hint level.
 *
 * Renders a horizontal track with 4 clickable positions (None, Light,
 * Medium, Heavy), a terracotta sliding indicator, and an illustration
 * area above the slider that shows a visual cue for the current level.
 *
 * The slider uses CSS transitions for smooth position changes and
 * opacity fades for the illustration swap. No Framer Motion required.
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

const LEVELS: Array<{ value: HintLevel; label: string; emoji: string }> = [
  { value: 0, label: 'None', emoji: '\uD83D\uDCBB' },
  { value: 1, label: 'Light', emoji: '\uD83D\uDCDA' },
  { value: 2, label: 'Medium', emoji: '\uD83D\uDC49' },
  { value: 3, label: 'Heavy', emoji: '\uD83C\uDF79' },
];

const LEVEL_DESCRIPTIONS: Record<HintLevel, string> = {
  0: 'No coaching hints',
  1: 'Subtle nudges only',
  2: 'Guided directions',
  3: 'Detailed walkthroughs',
};

/** Track has 3 gaps between 4 positions. Indicator moves in thirds. */
const POSITION_PERCENT: Record<HintLevel, string> = {
  0: '0%',
  1: '33.333%',
  2: '66.666%',
  3: '100%',
};

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

const illustrationContainerStyle: React.CSSProperties = {
  height: '80px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  width: '100%',
};

const illustrationStyle: React.CSSProperties = {
  fontSize: '48px',
  lineHeight: 1,
  transition: 'opacity 0.3s ease',
  userSelect: 'none',
};

const descriptionStyle: React.CSSProperties = {
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-muted)',
  margin: 0,
  textAlign: 'center',
  minHeight: '1.4em',
  transition: 'opacity 0.2s ease',
};

const trackContainerStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  maxWidth: '240px',
  height: '24px',
  display: 'flex',
  alignItems: 'center',
};

const trackStyle: React.CSSProperties = {
  position: 'absolute',
  left: '8px',
  right: '8px',
  height: '4px',
  background: 'var(--border-subtle)',
  borderRadius: '2px',
};

const dotsContainerStyle: React.CSSProperties = {
  position: 'absolute',
  left: '8px',
  right: '8px',
  top: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
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
// Sub-components
// ---------------------------------------------------------------------------

function SliderDot({
  level,
  isActive,
  onClick,
}: {
  level: HintLevel;
  isActive: boolean;
  onClick: () => void;
}) {
  const dotStyle: React.CSSProperties = {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    background: isActive ? 'var(--accent-primary)' : 'var(--bg-surface)',
    border: isActive ? '2px solid var(--accent-primary)' : '2px solid var(--border-default)',
    cursor: 'pointer',
    transition: 'background 0.3s ease, border-color 0.3s ease, transform 0.2s ease',
    transform: isActive ? 'scale(1.25)' : 'scale(1)',
    zIndex: isActive ? 2 : 1,
    position: 'relative',
    padding: 0,
    outline: 'none',
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <button
      type="button"
      style={dotStyle}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-label={`Set hint level to ${LEVELS[level]!.label}`}
      data-level={level}
      data-active={isActive}
    />
  );
}

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
    [level, onChange],
  );

  const activeConfig = LEVELS[level]!;

  // Indicator bar that slides along the track to show progress
  const indicatorStyle: React.CSSProperties = {
    position: 'absolute',
    left: '8px',
    height: '4px',
    background: 'var(--accent-primary)',
    borderRadius: '2px',
    width: POSITION_PERCENT[level],
    transition: 'width 0.3s ease',
  };

  return (
    <div style={containerStyle} role="group" aria-label="Hint level selector">
      {/* Illustration area */}
      <div style={illustrationContainerStyle} aria-hidden="true">
        <span
          style={illustrationStyle}
          data-testid="hint-illustration"
          key={level}
        >
          {activeConfig.emoji}
        </span>
      </div>

      {/* Description */}
      <p style={descriptionStyle} aria-live="polite">
        {LEVEL_DESCRIPTIONS[level]}
      </p>

      {/* Slider track */}
      <div
        style={trackContainerStyle}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={3}
        aria-valuenow={level}
        aria-valuetext={`${activeConfig.label} - ${LEVEL_DESCRIPTIONS[level]}`}
        aria-label="Hint level"
        tabIndex={-1}
      >
        {/* Background track */}
        <div style={trackStyle} />

        {/* Active fill indicator */}
        <div style={indicatorStyle} data-testid="slider-indicator" />

        {/* Position dots */}
        <div style={dotsContainerStyle}>
          {LEVELS.map(({ value }) => (
            <SliderDot
              key={value}
              level={value}
              isActive={value === level}
              onClick={() => handleLevelClick(value)}
            />
          ))}
        </div>
      </div>

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
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
