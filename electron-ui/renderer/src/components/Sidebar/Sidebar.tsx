/**
 * CoachingSidebar -- Container component that composes all sidebar
 * sub-components and manages session state via WebSocket.
 *
 * Fills its parent container (height set by parent IDE.tsx).
 * Renders a vertical stack: tab bar (Issue Detail / Explanations),
 * IssueContext, HintSlider, PhaseStepper, review/commit controls,
 * ReviewResults, ExplanationsPanel, and modal portals.
 *
 * Handles session lifecycle messages, phase:transition, review:result,
 * buffer:update (for re-review detection), and git:exit_complete.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  IssueContext,
  Phase,
  HintLevel,
  ReviewResult,
  ReviewScope,
  AppView,
} from '@shared/types/entities';
import type {
  WebSocketMessage,
  SessionStartMessage,
  SessionRestoreMessage,
  PhaseTransitionMessage,
  ReviewResultMessage,
  ReviewProgressMessage,
} from '@shared/types/websocket-messages';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useHintLevel } from '../../hooks/useHintLevel';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { editorState } from '../../services/editor-state';
import { IssueContextDisplay } from './IssueContext';
import { HintSlider } from './HintSlider';
import { PhaseStepper } from './PhaseStepper';
import { ReviewResults } from './ReviewResults';
import { ExplanationsPanel } from './ExplanationsPanel';
import type { ExplanationEntry } from './ExplanationsPanel';
import { CommitModal } from '../Modals/CommitModal';
import { PrModal } from '../Modals/PrModal';
import { SaveDiscardModal } from '../Modals/SaveDiscardModal';

// ---------------------------------------------------------------------------
// Spring preset
// ---------------------------------------------------------------------------

/** Standard spring preset shared across Paige animations. */
const SPRING_TRANSITION = { type: 'spring' as const, stiffness: 300, damping: 28 };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CommitState = 'idle' | 'ready_to_commit' | 'needs_re_review';
type SidebarTab = 'issue' | 'explanations';

interface ReviewLogEntry {
  message: string;
  toolName?: string;
  timestamp: number;
}

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

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid var(--border-subtle)',
  flexShrink: 0,
};

const tabButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: 'var(--space-xs) var(--space-sm)',
  background: 'none',
  border: 'none',
  borderBottom: '2px solid transparent',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  fontWeight: 500,
  cursor: 'pointer',
  color: 'var(--text-muted)',
  transition: 'color 0.15s ease, border-color 0.15s ease',
};

const tabButtonActiveStyle: React.CSSProperties = {
  ...tabButtonStyle,
  color: 'var(--text-primary)',
  borderBottomColor: 'var(--accent-primary, #d97757)',
};

const reviewSectionStyle: React.CSSProperties = {
  padding: 'var(--space-sm) var(--space-md)',
  borderTop: '1px solid var(--border-subtle)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-xs)',
};

const reviewButtonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 0,
  alignItems: 'stretch',
  position: 'relative',
};

const reviewMainButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: 'var(--space-xs) var(--space-sm)',
  borderRadius: '6px 0 0 6px',
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background 0.15s ease',
  textAlign: 'center',
};

const reviewDropdownButtonStyle: React.CSSProperties = {
  width: '28px',
  padding: 0,
  borderRadius: '0 6px 6px 0',
  border: '1px solid var(--border-subtle)',
  borderLeft: 'none',
  background: 'var(--bg-surface)',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '10px',
  transition: 'background 0.15s ease',
};

const dropdownMenuStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  right: 0,
  marginTop: '2px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '6px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
  zIndex: 100,
  minWidth: '180px',
  overflow: 'hidden',
};

const dropdownItemStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--space-xs) var(--space-sm)',
  border: 'none',
  background: 'transparent',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'background 0.1s ease',
};

const commitButtonBaseStyle: React.CSSProperties = {
  padding: 'var(--space-xs) var(--space-sm)',
  borderRadius: '6px',
  border: 'none',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-small-size)',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'opacity 0.15s ease, background 0.15s ease',
  textAlign: 'center',
};

const prButtonStyle: React.CSSProperties = {
  ...commitButtonBaseStyle,
  width: '100%',
  background: 'var(--accent-primary, #d97757)',
  color: '#faf9f5',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCommitButtonStyle(state: CommitState): React.CSSProperties {
  switch (state) {
    case 'ready_to_commit':
      return {
        ...commitButtonBaseStyle,
        background: 'var(--accent-primary, #d97757)',
        color: '#faf9f5',
      };
    case 'needs_re_review':
      return {
        ...commitButtonBaseStyle,
        background: 'transparent',
        border: '1px solid var(--text-muted)',
        color: 'var(--text-muted)',
        cursor: 'not-allowed',
        opacity: 0.6,
      };
    case 'idle':
    default:
      return {
        ...commitButtonBaseStyle,
        background: 'transparent',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-muted)',
        cursor: 'not-allowed',
        opacity: 0.5,
      };
  }
}

function getCommitButtonLabel(state: CommitState): string {
  switch (state) {
    case 'needs_re_review':
      return 'Re-review needed';
    case 'ready_to_commit':
      return 'Commit & Continue';
    case 'idle':
    default:
      return 'Commit & Continue';
  }
}

/** Get the active phase number from the phases list. */
function getActivePhaseNumber(phases: Phase[]): number {
  const active = phases.find((p) => p.status === 'active');
  return active ? active.number : 1;
}

/** Check if all phases are complete. */
function allPhasesComplete(phases: Phase[]): boolean {
  return phases.every((p) => p.status === 'complete');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CoachingSidebarProps {
  initialIssueContext?: IssueContext | null;
  initialPhases?: Phase[] | null;
  onNavigate?: (view: AppView) => void;
  explainRequestCount?: number;
}

export function CoachingSidebar({
  initialIssueContext = null,
  initialPhases = null,
  onNavigate,
  explainRequestCount,
}: CoachingSidebarProps): React.ReactElement {
  // ---- Session state -------------------------------------------------------

  const [issueContext, setIssueContext] = useState<IssueContext | null>(initialIssueContext);
  const [phases, setPhases] = useState<Phase[] | null>(initialPhases);

  // ---- Review / commit state -----------------------------------------------

  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewLogs, setReviewLogs] = useState<ReviewLogEntry[]>([]);
  const [commitState, setCommitState] = useState<CommitState>('idle');
  const [showReviewDropdown, setShowReviewDropdown] = useState(false);

  // ---- Explanations state ---------------------------------------------------

  const [activeTab, setActiveTab] = useState<SidebarTab>('issue');
  const [explanations, setExplanations] = useState<ExplanationEntry[]>([]);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [expandedExplanationId, setExpandedExplanationId] = useState<string | null>(null);

  // ---- Modal state ---------------------------------------------------------

  const [commitModalOpen, setCommitModalOpen] = useState(false);
  const [prModalOpen, setPrModalOpen] = useState(false);
  const [saveDiscardModalOpen, setSaveDiscardModalOpen] = useState(false);

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

  // ---- React to explain requests from IDE ----------------------------------
  // Track previous count with state so we can detect new requests during render
  // (React-recommended pattern for adjusting state when a prop changes —
  //  avoids useEffect + setState which violates react-hooks/set-state-in-effect).

  const [prevExplainCount, setPrevExplainCount] = useState(0);
  if (explainRequestCount && explainRequestCount > prevExplainCount) {
    setPrevExplainCount(explainRequestCount);
    setActiveTab('explanations');
    setExplanationLoading(true);
    setExpandedExplanationId(null);
  }

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
      setReviewResult(null);
      setCommitState('idle');
      setExplanations([]);
      setExplanationLoading(false);
      setExpandedExplanationId(null);
      setActiveTab('issue');
    });

    const unsubTransition = on('phase:transition', (msg: WebSocketMessage) => {
      const { payload } = msg as PhaseTransitionMessage;
      setPhases((prev) => {
        if (prev === null) return prev;
        return prev.map((phase) =>
          phase.number === payload.phaseNumber ? { ...phase, status: payload.newStatus } : phase
        );
      });
      // Reset review state on phase transition
      setReviewResult(null);
      setCommitState('idle');
      setReviewLoading(false);
    });

    const unsubReviewProgress = on('review:progress', (msg: WebSocketMessage) => {
      const { payload } = msg as ReviewProgressMessage;
      setReviewLogs((prev) => {
        const next = [
          ...prev,
          { message: payload.message, toolName: payload.toolName, timestamp: Date.now() },
        ];
        return next.length > 50 ? next.slice(-50) : next;
      });
    });

    const unsubReviewResult = on('review:result', (msg: WebSocketMessage) => {
      const { payload } = msg as ReviewResultMessage;
      setReviewResult(payload);
      setReviewLoading(false);
      setReviewLogs([]);
      if (payload.phaseComplete === true) {
        setCommitState('ready_to_commit');
      } else {
        setCommitState('idle');
      }
    });

    const unsubReviewError = on('review:error', (msg: WebSocketMessage) => {
      const { payload } = msg as { payload: { error: string } };
      setReviewLoading(false);
      setReviewLogs([]);
      setReviewResult({
        overallFeedback: `Review failed: ${payload.error}. Please try again.`,
        codeComments: [],
      });
    });

    const unsubBufferUpdate = on('buffer:update', () => {
      // If we had a review result and the user edits code, they need to re-review.
      // Use the functional form of setReviewResult to read current value without
      // adding reviewResult to the dependency array.
      setReviewResult((prev) => {
        if (prev !== null) {
          setCommitState('needs_re_review');
        }
        return prev;
      });
    });

    const unsubExplainResponse = on('explain:response', (msg: WebSocketMessage) => {
      const { payload } = msg as unknown as {
        payload: { title: string; explanation: string; phaseConnection?: string };
      };
      const newId = `explain-${Date.now()}`;
      const entry: ExplanationEntry = {
        id: newId,
        title: payload.title,
        explanation: payload.explanation,
        phaseConnection: payload.phaseConnection,
        timestamp: Date.now(),
      };
      setExplanations((prev) => [entry, ...prev]);
      setExplanationLoading(false);
      setExpandedExplanationId(newId);
    });

    const unsubExplainError = on('explain:error', (msg: WebSocketMessage) => {
      const { payload } = msg as unknown as { payload: { error: string } };
      const newId = `explain-err-${Date.now()}`;
      const entry: ExplanationEntry = {
        id: newId,
        title: 'Explain failed',
        explanation: payload.error,
        timestamp: Date.now(),
      };
      setExplanations((prev) => [entry, ...prev]);
      setExplanationLoading(false);
      setExpandedExplanationId(newId);
    });

    const unsubGitExitComplete = on('git:exit_complete', () => {
      setSaveDiscardModalOpen(false);
      if (onNavigate) {
        onNavigate('dashboard');
      }
    });

    return () => {
      unsubStart();
      unsubRestore();
      unsubEnd();
      unsubTransition();
      unsubReviewProgress();
      unsubReviewResult();
      unsubReviewError();
      unsubBufferUpdate();
      unsubExplainResponse();
      unsubExplainError();
      unsubGitExitComplete();
    };
  }, [on, onNavigate]);

  // ---- Close dropdown on outside click ------------------------------------

  useEffect(() => {
    if (!showReviewDropdown) return;

    const handleClick = () => setShowReviewDropdown(false);
    // Use a short delay so the click that opened the dropdown does not
    // immediately close it.
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClick);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
    };
  }, [showReviewDropdown]);

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

  const handleReview = useCallback(
    (scope: ReviewScope) => {
      setReviewLoading(true);
      setReviewResult(null);
      setReviewLogs([]);
      setShowReviewDropdown(false);

      const activeTabPath = editorState.getActiveTabPath();
      const openTabs = editorState.getTabs();
      const openFilePaths = openTabs.map((t) => t.path);

      void send('review:request', {
        scope,
        activeFilePath: activeTabPath,
        openFilePaths,
      });
    },
    [send]
  );

  const handleReviewPhase = useCallback(() => {
    handleReview('phase');
  }, [handleReview]);

  const handleDismissReview = useCallback(() => {
    setReviewResult(null);
  }, []);

  const handleCodeCommentClick = useCallback(
    (filePath: string, _line: number) => {
      // Open the file in the editor; decoration-based navigation
      // will handle scrolling to the specific line.
      void send('file:open', { path: filePath });
    },
    [send]
  );

  const handleCommitClick = useCallback(() => {
    if (commitState === 'ready_to_commit') {
      setCommitModalOpen(true);
    }
  }, [commitState]);

  const handleToggleExplanation = useCallback((id: string) => {
    setExpandedExplanationId((prev) => (prev === id ? null : id));
  }, []);

  const handleOpenPr = useCallback(() => {
    setPrModalOpen(true);
  }, []);

  const handleSaveAndExit = useCallback(() => {
    void send('git:save_and_exit', {});
  }, [send]);

  const handleDiscardAndExit = useCallback(() => {
    void send('git:discard_and_exit', {});
  }, [send]);

  const handleSaveDiscardClose = useCallback(() => {
    setSaveDiscardModalOpen(false);
  }, []);

  const handleNavigateFromPr = useCallback(
    (view: AppView) => {
      if (onNavigate) {
        onNavigate(view);
      }
    },
    [onNavigate]
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

  // ---- Derived state -------------------------------------------------------

  const activePhaseNumber = getActivePhaseNumber(phases);
  const isAllComplete = allPhasesComplete(phases);

  // ---- Active session ------------------------------------------------------

  return (
    <aside style={sidebarStyle} aria-label="Coaching sidebar">
      {/* Tab bar */}
      <div style={tabBarStyle}>
        <button
          type="button"
          style={activeTab === 'issue' ? tabButtonActiveStyle : tabButtonStyle}
          onClick={() => setActiveTab('issue')}
        >
          Issue Detail
        </button>
        <button
          type="button"
          style={activeTab === 'explanations' ? tabButtonActiveStyle : tabButtonStyle}
          onClick={() => setActiveTab('explanations')}
        >
          Explanations
        </button>
      </div>

      {activeTab === 'issue' ? (
        <>
          {/* Issue context */}
          <IssueContextDisplay issueContext={issueContext} />

          {/* Scrollable content area for hint controls + phase stepper + review */}
          <div style={scrollableAreaStyle}>
            {/* Hint slider */}
            <div style={hintSectionStyle}>
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
                <PhaseStepper
                  phases={phases}
                  hintLevel={hintLevel}
                  onExpandStep={handleExpandStep}
                />
              </motion.div>
            </AnimatePresence>

            {/* Review / Commit / PR controls */}
            <div style={reviewSectionStyle}>
              {isAllComplete ? (
                /* All phases complete: show Open PR button */
                <button
                  type="button"
                  style={prButtonStyle}
                  onClick={handleOpenPr}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.85';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  Open Pull Request
                </button>
              ) : (
                /* Active phase: show review + commit controls */
                <>
                  {/* Review split button */}
                  <div style={reviewButtonRowStyle}>
                    <button
                      type="button"
                      style={reviewMainButtonStyle}
                      onClick={handleReviewPhase}
                      disabled={reviewLoading}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-inset)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--bg-surface)';
                      }}
                    >
                      {reviewLoading ? 'Reviewing...' : 'Review Phase'}
                    </button>
                    <button
                      type="button"
                      style={reviewDropdownButtonStyle}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowReviewDropdown((prev) => !prev);
                      }}
                      aria-label="Review scope options"
                      aria-expanded={showReviewDropdown}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-inset)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--bg-surface)';
                      }}
                    >
                      &#x25BC;
                    </button>

                    {/* Dropdown menu */}
                    {showReviewDropdown && (
                      <div style={dropdownMenuStyle}>
                        <button
                          type="button"
                          style={dropdownItemStyle}
                          onClick={() => handleReview('current_file')}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--bg-surface)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          Review Current File
                        </button>
                        <button
                          type="button"
                          style={dropdownItemStyle}
                          onClick={() => handleReview('open_files')}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--bg-surface)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          Review Open Files
                        </button>
                        <button
                          type="button"
                          style={dropdownItemStyle}
                          onClick={() => handleReview('current_task')}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--bg-surface)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          Review Current Task
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Commit button */}
                  <button
                    type="button"
                    style={getCommitButtonStyle(commitState)}
                    onClick={handleCommitClick}
                    disabled={commitState !== 'ready_to_commit'}
                    title={
                      commitState === 'needs_re_review'
                        ? 'Code changed since last review. Review again before committing.'
                        : commitState === 'idle'
                          ? 'Complete a review first to enable committing.'
                          : 'Commit this phase and continue to the next.'
                    }
                  >
                    {getCommitButtonLabel(commitState)}
                  </button>
                </>
              )}
            </div>

            {/* Review results */}
            <ReviewResults
              result={reviewResult}
              loading={reviewLoading}
              logs={reviewLogs}
              onDismiss={handleDismissReview}
              onCodeCommentClick={handleCodeCommentClick}
            />
          </div>
        </>
      ) : (
        <div style={scrollableAreaStyle}>
          <ExplanationsPanel
            explanations={explanations}
            loading={explanationLoading}
            expandedId={expandedExplanationId}
            onToggle={handleToggleExplanation}
          />
        </div>
      )}

      {/* Modals */}
      <CommitModal
        isOpen={commitModalOpen}
        phaseNumber={activePhaseNumber}
        onClose={() => setCommitModalOpen(false)}
      />
      <PrModal
        isOpen={prModalOpen}
        onClose={() => setPrModalOpen(false)}
        onNavigate={handleNavigateFromPr}
      />
      <SaveDiscardModal
        isOpen={saveDiscardModalOpen}
        onSave={handleSaveAndExit}
        onDiscard={handleDiscardAndExit}
        onClose={handleSaveDiscardClose}
      />
    </aside>
  );
}
