/**
 * PlanningLoader -- Full-screen loading view during the planning agent pipeline.
 *
 * Composes the ProgressBar, ActivityLog, and usePlanningProgress hook into
 * a cohesive loading experience. Displays an ASCII "PAIGE" banner with a
 * breathing pulse animation, the issue title being worked on, a phase-aware
 * progress bar, and a scrolling activity log.
 *
 * When the planning agent completes, a brief 600ms delay allows the progress
 * bar to animate to 100% before transitioning to the IDE view via onComplete.
 *
 * Error states show the error message with an optional retry button.
 */

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ProgressBar } from '../components/planning/ProgressBar';
import { ActivityLog } from '../components/planning/ActivityLog';
import { usePlanningProgress } from '../hooks/usePlanningProgress';
import type { PlanningCompletePayload } from '@shared/types/websocket-messages';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlanningLoaderProps {
  /** Called when planning completes, after a brief animation delay. */
  onComplete: (result: PlanningCompletePayload) => void;
  /** Called when the planning agent encounters an error. */
  onError?: (error: string) => void;
  /** Called when the user clicks the retry button in the error state. */
  onRetry?: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * ASCII art "PAIGE" using figlet `slant` font style.
 * Shared with the Landing view for brand consistency.
 */
const PAIGE_ASCII = `    ____  ___    ____________
   / __ \\/   |  /  _/ ____/ ____
  / /_/ / /| |  / // / __/ __/
 / ____/ ___ |_/ // /_/ / /___
/_/   /_/  |_/___/\\____/_____/`;

/** Delay (ms) before calling onComplete, to let the 100% animation play. */
const COMPLETION_DELAY_MS = 600;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-lg, 24px)',
  background: 'var(--bg-base, #111)',
  padding: 'var(--space-lg, 24px)',
  fontFamily: 'var(--font-family, monospace)',
};

const bannerStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '14px',
  lineHeight: 1.2,
  color: 'var(--accent-primary, #d97757)',
  whiteSpace: 'pre',
  textAlign: 'center',
  userSelect: 'none',
};

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family, monospace)',
  fontSize: '16px',
  color: 'var(--text-secondary, #999)',
  textAlign: 'center',
};

const progressContainerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '600px',
};

const logContainerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '600px',
};

const errorStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--space-md, 12px)',
};

const errorTextStyle: React.CSSProperties = {
  color: 'var(--status-error, #ef4444)',
  fontFamily: 'var(--font-family, monospace)',
  fontSize: '14px',
  textAlign: 'center',
};

const retryButtonStyle: React.CSSProperties = {
  padding: '8px 20px',
  background: 'var(--accent-primary, #d97757)',
  border: 'none',
  borderRadius: '6px',
  color: 'var(--text-on-accent, #fff)',
  fontFamily: 'var(--font-family, monospace)',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlanningLoader({
  onComplete,
  onError,
  onRetry,
}: PlanningLoaderProps): React.ReactElement {
  const { status, issueTitle, currentPhase, progress, logs, result, error } =
    usePlanningProgress();

  // Transition to IDE when complete -- brief delay for 100% animation.
  useEffect(() => {
    if (status === 'complete' && result) {
      const timer = setTimeout(() => onComplete(result), COMPLETION_DELAY_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status, result, onComplete]);

  // Notify parent of errors.
  useEffect(() => {
    if (status === 'error' && error && onError) {
      onError(error);
    }
  }, [status, error, onError]);

  return (
    <div style={containerStyle} role="status" aria-label="Planning in progress">
      {/* ASCII Banner */}
      <motion.pre
        style={bannerStyle}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        {PAIGE_ASCII}
      </motion.pre>

      {/* Issue title */}
      {issueTitle && (
        <motion.p
          style={titleStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Preparing: {issueTitle}
        </motion.p>
      )}

      {/* Progress Bar */}
      <div style={progressContainerStyle}>
        <ProgressBar currentPhase={currentPhase} progress={progress} />
      </div>

      {/* Activity Log */}
      <div style={logContainerStyle}>
        <ActivityLog logs={logs} />
      </div>

      {/* Error state */}
      {status === 'error' && (
        <motion.div
          style={errorStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p style={errorTextStyle}>{error}</p>
          {onRetry && (
            <button onClick={onRetry} style={retryButtonStyle}>
              Retry
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
}
