/**
 * CoachingSidebar -- Container component that composes all sidebar
 * sub-components and manages session state via WebSocket.
 *
 * Fills its parent container (280px wide, height set by parent IDE.tsx).
 * Renders a vertical stack: IssueContext, HintIllustration + HintSlider,
 * and PhaseStepper. Before a session starts, shows a muted placeholder.
 *
 * Handles three session lifecycle messages (start, restore, end) and
 * phase:transition messages with Framer Motion spring animations.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { IssueContext, Phase, HintLevel } from '@shared/types/entities';
import type {
  WebSocketMessage,
  SessionStartMessage,
  SessionRestoreMessage,
  PhaseTransitionMessage,
} from '@shared/types/websocket-messages';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useHintLevel } from '../../hooks/useHintLevel';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { IssueContextDisplay } from './IssueContext';
import { HintSlider } from './HintSlider';
import { HintIllustration } from './HintIllustration';
import { PhaseStepper } from './PhaseStepper';

// ---------------------------------------------------------------------------
// Spring preset
// ---------------------------------------------------------------------------

/** Standard spring preset shared across Paige animations. */
const SPRING_TRANSITION = { type: 'spring' as const, stiffness: 300, damping: 28 };

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const sidebarStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  width: '100%',
  backgroundColor: 'var(--bg-surface)',
  borderRight: '1px solid var(--border-subtle)',
  overflow: 'hidden',
};

const scrollableAreaStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
};

const hintSectionStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--border-subtle)',
};

const stepperSectionStyle: React.CSSProperties = {
  padding: 'var(--space-sm) var(--space-md)',
};

const placeholderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  color: 'var(--text-muted)',
  textAlign: 'center',
  padding: 'var(--space-md)',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CoachingSidebarProps {
  initialIssueContext?: IssueContext | null;
  initialPhases?: Phase[] | null;
}

export function CoachingSidebar({
  initialIssueContext = null,
  initialPhases = null,
}: CoachingSidebarProps): React.ReactElement {
  // ---- Session state -------------------------------------------------------

  const [issueContext, setIssueContext] = useState<IssueContext | null>(initialIssueContext);
  const [phases, setPhases] = useState<Phase[] | null>(initialPhases);

  // ---- Hooks ---------------------------------------------------------------

  const { send, on } = useWebSocket();
  const { hintLevel, setHintLevel, cycleHintLevel, increaseHintLevel, decreaseHintLevel } =
    useHintLevel();

  // Register keyboard shortcuts for hint-level manipulation
  useKeyboardShortcuts({
    onCycleHintLevel: cycleHintLevel,
    onDecreaseHintLevel: decreaseHintLevel,
    onIncreaseHintLevel: increaseHintLevel,
  });

  // ---- WebSocket listeners -------------------------------------------------

  useEffect(() => {
    const unsubStart = on('session:start', (msg: WebSocketMessage) => {
      const { payload } = msg as SessionStartMessage;
      setIssueContext(payload.issueContext);
      setPhases(payload.phases);
    });

    const unsubRestore = on('session:restore', (msg: WebSocketMessage) => {
      const { payload } = msg as SessionRestoreMessage;
      setIssueContext(payload.issueContext);
      setPhases(payload.phases);
    });

    const unsubEnd = on('session:end', () => {
      setIssueContext(null);
      setPhases(null);
    });

    const unsubTransition = on('phase:transition', (msg: WebSocketMessage) => {
      const { payload } = msg as PhaseTransitionMessage;
      setPhases((prev) => {
        if (prev === null) return prev;
        return prev.map((phase) =>
          phase.number === payload.phaseNumber ? { ...phase, status: payload.newStatus } : phase
        );
      });
    });

    return () => {
      unsubStart();
      unsubRestore();
      unsubEnd();
      unsubTransition();
    };
  }, [on]);

  // ---- Handlers ------------------------------------------------------------

  const handleExpandStep = useCallback(
    (phaseNumber: 1 | 2 | 3 | 4 | 5, stepIndex: number) => {
      void send('phase:expand_step', { phaseNumber, stepIndex });
    },
    [send]
  );

  const handleHintChange = useCallback(
    (level: HintLevel) => {
      setHintLevel(level);
    },
    [setHintLevel]
  );

  // ---- Loading state -------------------------------------------------------

  const hasSession = issueContext !== null && phases !== null;

  if (!hasSession) {
    return (
      <aside style={sidebarStyle} aria-label="Coaching sidebar">
        <div style={placeholderStyle}>Waiting for session...</div>
      </aside>
    );
  }

  // ---- Active session ------------------------------------------------------

  return (
    <aside style={sidebarStyle} aria-label="Coaching sidebar">
      {/* Issue context -- always visible at the top, not scrollable */}
      <IssueContextDisplay issueContext={issueContext} />

      {/* Scrollable content area for hint controls + phase stepper */}
      <div style={scrollableAreaStyle}>
        {/* Hint illustration + slider */}
        <div style={hintSectionStyle}>
          <HintIllustration level={hintLevel} />
          <HintSlider level={hintLevel} onChange={handleHintChange} />
        </div>

        {/* Phase stepper with layout animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={phases.map((p) => `${p.number}:${p.status}`).join(',')}
            style={stepperSectionStyle}
            layout
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0.8 }}
            transition={SPRING_TRANSITION}
          >
            <PhaseStepper phases={phases} hintLevel={hintLevel} onExpandStep={handleExpandStep} />
          </motion.div>
        </AnimatePresence>
      </div>
    </aside>
  );
}
