/**
 * PhaseStepper -- Vertical stepper showing coaching phases (1-5).
 *
 * Renders a vertical timeline with connecting lines between phase
 * indicators. Each phase circle reflects its status: complete (green
 * checkmark), active (terracotta with pulse animation), or pending
 * (outlined). Content visibility is governed by the current hint
 * level, progressively revealing summary text, sub-step titles, and
 * expandable accordion descriptions.
 */

import { useState } from 'react';
import type { Phase, HintLevel } from '@shared/types/entities';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PhaseStepperProps {
  phases: Phase[];
  hintLevel: HintLevel;
  onExpandStep?: (phaseNumber: 1 | 2 | 3 | 4 | 5, stepIndex: number) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Unique ID for the injected keyframes style element. */
const STYLE_ID = 'paige-phase-stepper-keyframes';

/** CSS keyframes for the terracotta pulse on the active phase indicator. */
const PULSE_KEYFRAMES = `
@keyframes pulse-terracotta {
  0%, 100% { box-shadow: 0 0 0 0 rgba(217, 119, 87, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(217, 119, 87, 0); }
}
`;

// ---------------------------------------------------------------------------
// Keyframes injection
// ---------------------------------------------------------------------------

/**
 * Injects the pulse keyframes into the document head once. Subsequent
 * calls are no-ops because we check for the style element by ID.
 */
function ensureKeyframes(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = PULSE_KEYFRAMES;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  padding: 'var(--space-sm) 0',
};

const phaseRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'flex-start',
  gap: 'var(--space-sm)',
  position: 'relative',
};

const indicatorColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: 20,
  flexShrink: 0,
  position: 'relative',
};

const connectingLineStyle: React.CSSProperties = {
  width: 2,
  flex: 1,
  minHeight: 'var(--space-md)',
  background: 'var(--border-subtle)',
};

const contentColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-xs)',
  paddingBottom: 'var(--space-md)',
  minWidth: 0,
  flex: 1,
};

const phaseTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-base-size)',
  color: 'var(--text-primary)',
  margin: 0,
  lineHeight: 1.4,
};

const phaseTitleActiveStyle: React.CSSProperties = {
  ...phaseTitleStyle,
  fontWeight: 700,
};

const summaryStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-secondary)',
  margin: 0,
  lineHeight: 1.5,
};

const stepsListStyle: React.CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const stepTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-secondary)',
  margin: 0,
  lineHeight: 1.4,
};

const stepButtonStyle: React.CSSProperties = {
  ...stepTitleStyle,
  background: 'none',
  border: 'none',
  padding: '2px 0',
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-xs)',
};

const stepDescriptionStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-muted)',
  margin: 0,
  padding: '2px 0 var(--space-xs) var(--space-sm)',
  lineHeight: 1.5,
};

// ---------------------------------------------------------------------------
// Indicator helpers
// ---------------------------------------------------------------------------

const CIRCLE_COMPLETE: React.CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: '50%',
  background: 'var(--status-success)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  color: 'var(--bg-surface)',
  fontSize: 8,
  fontWeight: 700,
  lineHeight: 1,
};

const CIRCLE_ACTIVE: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: '50%',
  background: 'var(--accent-primary)',
  flexShrink: 0,
  animation: 'pulse-terracotta 2s ease-in-out infinite',
};

const CIRCLE_PENDING: React.CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: '50%',
  background: 'transparent',
  border: '2px solid var(--text-muted)',
  flexShrink: 0,
  boxSizing: 'border-box',
};

function PhaseIndicator({ status }: { status: Phase['status'] }): React.ReactElement {
  if (status === 'complete') {
    return (
      <div style={CIRCLE_COMPLETE} aria-label="Phase complete" data-testid="indicator-complete">
        {'\u2713'}
      </div>
    );
  }

  if (status === 'active') {
    return <div style={CIRCLE_ACTIVE} aria-label="Phase active" data-testid="indicator-active" />;
  }

  return <div style={CIRCLE_PENDING} aria-label="Phase pending" data-testid="indicator-pending" />;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Vertical stepper for coaching phases.
 *
 * Each phase is rendered as a row with a status indicator on the left
 * connected by a 2px vertical line, and phase content on the right.
 * The amount of visible content is controlled by `hintLevel`:
 *
 * - Level 0: title only
 * - Level 1: title + summary (active phase)
 * - Level 2: title + summary + sub-step titles (active phase)
 * - Level 3: title + summary + sub-step accordion (active phase)
 */
export function PhaseStepper({
  phases,
  hintLevel,
  onExpandStep,
}: PhaseStepperProps): React.ReactElement {
  ensureKeyframes();

  const [expandedStepIndex, setExpandedStepIndex] = useState<number | null>(null);

  function handleStepClick(phase: Phase, stepIndex: number): void {
    if (expandedStepIndex === stepIndex) {
      // Collapse if already open
      setExpandedStepIndex(null);
    } else {
      // Open this step, close previous
      setExpandedStepIndex(stepIndex);
      onExpandStep?.(phase.number, stepIndex);
    }
  }

  return (
    <nav style={containerStyle} aria-label="Coaching phases">
      {phases.map((phase, phaseIndex) => {
        const isActive = phase.status === 'active';
        const isLast = phaseIndex === phases.length - 1;
        const showSummary = isActive && hintLevel >= 1 && phase.summary;
        const showSteps = isActive && hintLevel >= 2 && phase.steps && phase.steps.length > 0;
        const isAccordion = hintLevel >= 3;

        return (
          <div key={phase.number} style={phaseRowStyle} data-testid={`phase-${phase.number}`}>
            {/* Left indicator column */}
            <div style={indicatorColumnStyle}>
              <PhaseIndicator status={phase.status} />
              {!isLast && <div style={connectingLineStyle} data-testid="connecting-line" />}
            </div>

            {/* Right content column */}
            <div style={contentColumnStyle}>
              {/* Phase title */}
              <p style={isActive ? phaseTitleActiveStyle : phaseTitleStyle}>
                {phase.title}
              </p>

              {/* Summary (hint level >= 1, active phase only) */}
              {showSummary && <p style={summaryStyle}>{phase.summary}</p>}

              {/* Sub-steps (hint level >= 2, active phase only) */}
              {showSteps && (
                <ul style={stepsListStyle} role="list">
                  {phase.steps!.map((step, stepIndex) => {
                    const isExpanded = expandedStepIndex === stepIndex;
                    const chevron = isExpanded ? '\u25BC' : '\u25B6';

                    return (
                      <li key={stepIndex}>
                        {isAccordion ? (
                          <>
                            <button
                              type="button"
                              style={stepButtonStyle}
                              onClick={() => handleStepClick(phase, stepIndex)}
                              aria-expanded={isExpanded}
                              aria-label={`Step: ${step.title}`}
                            >
                              <span style={{ fontSize: 8, flexShrink: 0 }}>{chevron}</span>
                              {step.title}
                            </button>
                            {isExpanded && step.description && (
                              <p style={stepDescriptionStyle}>{step.description}</p>
                            )}
                          </>
                        ) : (
                          <p style={stepTitleStyle}>{step.title}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
