/**
 * ProgressBar -- Horizontal progress bar with phase step indicators.
 *
 * Renders a horizontal track showing overall planning progress, with
 * four phase dots below it. Each dot reflects its status: complete
 * (green checkmark), active (terracotta with pulse animation), or
 * pending (outlined). Labels appear beneath each dot.
 *
 * Used on the planning loading screen while the backend runs its
 * four-phase planning pipeline (fetching, exploring, planning,
 * writing hints).
 */

import React from 'react';
import { motion } from 'framer-motion';
import type { PlanningPhase } from '@shared/types/websocket-messages';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProgressBarProps {
  /** The currently active planning phase, or null if none. */
  currentPhase: PlanningPhase | null;
  /** Overall progress percentage (0-100). */
  progress: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASES: Array<{ key: PlanningPhase; label: string }> = [
  { key: 'fetching', label: 'Fetching Issue' },
  { key: 'exploring', label: 'Exploring Codebase' },
  { key: 'planning', label: 'Building Plan' },
  { key: 'writing_hints', label: 'Writing Hints' },
];

const PHASE_ORDER: Record<PlanningPhase, number> = {
  fetching: 0,
  exploring: 1,
  planning: 2,
  writing_hints: 3,
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '600px',
};

const trackStyle: React.CSSProperties = {
  height: '4px',
  background: 'var(--bg-elevated, #2a2a2a)',
  borderRadius: '2px',
  overflow: 'hidden',
  marginBottom: '16px',
};

const fillStyle: React.CSSProperties = {
  height: '100%',
  background: 'var(--accent-primary, #d97757)',
  borderRadius: '2px',
};

const stepsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
};

const stepStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
};

const dotStyle: React.CSSProperties = {
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  border: '2px solid transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const checkStyle: React.CSSProperties = {
  color: 'var(--text-primary, #e5e5e5)',
  fontSize: '12px',
  fontWeight: 700,
};

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontFamily: 'var(--font-family, monospace)',
  whiteSpace: 'nowrap',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProgressBar({ currentPhase, progress }: ProgressBarProps): React.ReactElement {
  const currentIndex = currentPhase ? PHASE_ORDER[currentPhase] : -1;

  return (
    <div style={containerStyle} role="group" aria-label="Planning progress">
      {/* Progress track */}
      <div style={trackStyle}>
        <motion.div
          style={fillStyle}
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 14 }}
        />
      </div>

      {/* Phase steps */}
      <div style={stepsStyle}>
        {PHASES.map((phase, i) => {
          const isComplete = i < currentIndex;
          const isActive = i === currentIndex;

          return (
            <div
              key={phase.key}
              data-testid={`step-${phase.key}`}
              data-active={isActive ? 'true' : 'false'}
              style={stepStyle}
            >
              <motion.div
                style={{
                  ...dotStyle,
                  background: isComplete
                    ? 'var(--status-success, #4ade80)'
                    : isActive
                      ? 'var(--accent-primary, #d97757)'
                      : 'var(--bg-elevated, #2a2a2a)',
                  borderColor:
                    isComplete || isActive ? 'transparent' : 'var(--text-muted, #666)',
                }}
                animate={
                  isActive
                    ? {
                        boxShadow: [
                          '0 0 0 0 rgba(217, 119, 87, 0.4)',
                          '0 0 0 6px rgba(217, 119, 87, 0)',
                          '0 0 0 0 rgba(217, 119, 87, 0.4)',
                        ],
                      }
                    : {}
                }
                transition={isActive ? { duration: 2, repeat: Infinity } : {}}
              >
                {isComplete && (
                  <span style={checkStyle} data-testid="check-complete">
                    {'\u2713'}
                  </span>
                )}
              </motion.div>
              <span
                style={{
                  ...labelStyle,
                  color: isActive
                    ? 'var(--text-primary, #e5e5e5)'
                    : isComplete
                      ? 'var(--text-secondary, #999)'
                      : 'var(--text-muted, #666)',
                }}
              >
                {phase.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
