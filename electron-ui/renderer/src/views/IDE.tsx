/**
 * IDE -- Five-panel IDE layout for coaching sessions.
 *
 * Layout:
 *   - Left sidebar: File Explorer (220px, collapsible to 32px)
 *   - Center top: EditorTabs + CodeEditor + FloatingExplainButton (flex, 70%)
 *   - Center: StatusBar (32px)
 *   - Center bottom: Terminal area (30% height)
 *   - Right sidebar: Coaching Sidebar (560px, collapsible to 32px)
 *
 * Sidebars collapse independently with Framer Motion spring animations.
 * Auto-collapses sidebars at <800px width, hides terminal at <500px height.
 *
 * The editor area is wired to file operations (open/save/close) via the
 * useFileOperations hook, which handles WebSocket messaging, debounced
 * buffer updates, and keyboard shortcuts (Cmd+S, Cmd+W).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import type { editor as MonacoEditorNS } from 'monaco-editor';
import type { AppView, IssueContext, Phase } from '@shared/types/entities';
import { CodeEditor } from '../components/Editor/Editor';
import { EditorTabs } from '../components/Editor/EditorTabs';
import { StatusBar } from '../components/Editor/StatusBar';
import { FloatingExplainButton } from '../components/Editor/FloatingExplainButton';
import type { ExplainPayload } from '../components/Editor/FloatingExplainButton';
import { FileTree } from '../components/FileExplorer/FileTree';
import { useFileOperations } from '../hooks/useFileOperations';
import { useFileTree } from '../hooks/useFileTree';
import { useFileExplorerHints } from '../hooks/useFileExplorerHints';
import { useWebSocket } from '../hooks/useWebSocket';
import { useCoachingMessages } from '../hooks/useCoachingMessages';
import { useHintLevel } from '../hooks/useHintLevel';
import { useReviewNavigation } from '../hooks/useReviewNavigation';
import { CoachingOverlay } from '../components/Hints/CoachingOverlay';
import { CoachingToastContainer } from '../components/Hints/EditorToast';
import { TerminalPanel } from '../components/Terminal/Terminal';
import { CoachingSidebar } from '../components/Sidebar/Sidebar';
import { editorState } from '../services/editor-state';

// ---------------------------------------------------------------------------
// Animation spring preset
// ---------------------------------------------------------------------------

/** Spring preset: balanced, general-purpose */
const SPRING_STANDARD = { stiffness: 300, damping: 28 };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IDEProps {
  onNavigate: (view: AppView, context?: { issueNumber?: number }) => void;
  planningResult?: import('@shared/types/websocket-messages').PlanningCompletePayload | null;
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const SIDEBAR_LEFT_EXPANDED = 220;
const SIDEBAR_LEFT_COLLAPSED = 32;
const SIDEBAR_RIGHT_EXPANDED = 560;
const SIDEBAR_RIGHT_COLLAPSED = 32;
const AUTO_COLLAPSE_WIDTH = 800;
const AUTO_HIDE_TERMINAL_HEIGHT = 500;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const collapseButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-family), monospace',
  fontSize: 'var(--font-small-size)',
  cursor: 'pointer',
  padding: '4px 6px',
  lineHeight: 1,
};

const sidebarHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 var(--space-xs)',
  height: 'var(--status-bar-height)',
  borderBottom: '1px solid var(--border-subtle)',
};

const sidebarLabelStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 'var(--font-small-size)',
  fontFamily: 'var(--font-family), monospace',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

/**
 * Editor area wrapper: stacks EditorTabs on top, CodeEditor in the middle,
 * and positions the FloatingExplainButton absolutely over the editor.
 */
const editorAreaStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  minHeight: 0,
  position: 'relative',
};

// ---------------------------------------------------------------------------
// Subscription helper for active tab path (used for FloatingExplainButton)
// ---------------------------------------------------------------------------

function useActiveTabPath(): string | undefined {
  const [path, setPath] = useState<string | undefined>(() => editorState.getActiveTabPath());

  useEffect(() => {
    const unsubscribe = editorState.subscribe(() => {
      setPath(editorState.getActiveTabPath());
    });
    return unsubscribe;
  }, []);

  return path;
}

// ---------------------------------------------------------------------------
// IDE component
// ---------------------------------------------------------------------------

export function IDE({ onNavigate, planningResult }: IDEProps) {
  // Sidebar and terminal visibility state
  const [leftCollapsed, setLeftCollapsed] = useState(() => window.innerWidth < AUTO_COLLAPSE_WIDTH);
  const [rightCollapsed, setRightCollapsed] = useState(
    () => window.innerWidth < AUTO_COLLAPSE_WIDTH
  );
  const [terminalHidden, setTerminalHidden] = useState(
    () => window.innerHeight < AUTO_HIDE_TERMINAL_HEIGHT
  );

  // Active tab path for FloatingExplainButton and coaching overlay
  const activeTabPath = useActiveTabPath();

  // Ref to the Monaco editor instance (shared with FloatingExplainButton and effects).
  // The ref is used by FloatingExplainButton and auto-dismiss effect. The state
  // variable is used by CoachingOverlay during render (refs can't be read during render).
  const editorInstanceRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  const [editorInstance, setEditorInstance] = useState<MonacoEditorNS.IStandaloneCodeEditor | null>(
    null
  );

  // Callback from CodeEditor when Monaco is ready — syncs into React state
  // so FloatingExplainButton and CoachingOverlay can consume it during render.
  const handleEditorReady = useCallback((editor: MonacoEditorNS.IStandaloneCodeEditor) => {
    setEditorInstance(editor);
  }, []);

  // Wire file operations (Cmd+S, Cmd+W, WebSocket flows)
  useFileOperations();

  // File tree state from WebSocket
  const { tree, openFile } = useFileTree();

  // File explorer hint glows
  const { hints: fileHints, autoExpandPaths } = useFileExplorerHints();

  // Convert ReadonlyMap to Map for FileTree prop compatibility
  const hintsMap = fileHints instanceof Map ? fileHints : new Map(fileHints);

  // Hint level (coaching verbosity 0-3)
  const { hintLevel } = useHintLevel();

  // Coaching messages (anchored balloons + unanchored toasts)
  const { messages, dismissMessage, expandedIds, expandMessage } = useCoachingMessages();

  // Review navigation (focused message for coaching overlay)
  const { focusedMessageId } = useReviewNavigation();

  // WebSocket send for review and explain
  const { send } = useWebSocket();

  // -------------------------------------------------------------------------
  // Resize handler: auto-collapse sidebars
  // -------------------------------------------------------------------------

  const handleResize = useCallback(() => {
    const { innerWidth, innerHeight } = window;
    setLeftCollapsed(innerWidth < AUTO_COLLAPSE_WIDTH);
    setRightCollapsed(innerWidth < AUTO_COLLAPSE_WIDTH);
    setTerminalHidden(innerHeight < AUTO_HIDE_TERMINAL_HEIGHT);
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // -------------------------------------------------------------------------
  // Auto-dismiss coaching messages on code edit overlap (T443)
  // -------------------------------------------------------------------------

  useEffect(() => {
    const editor = editorInstanceRef.current;
    if (!editor) return;

    const disposable = editor.onDidChangeModelContent(
      (event: MonacoEditorNS.IModelContentChangedEvent) => {
        if (messages.length === 0) return;

        for (const change of event.changes) {
          const editStartLine = change.range.startLineNumber;
          const editEndLine = change.range.endLineNumber;
          const editStartCol = change.range.startColumn;
          const editEndCol = change.range.endColumn;

          for (const msg of messages) {
            if (!msg.anchor || msg.anchor.path !== activeTabPath) continue;

            const { startLine, endLine, startColumn, endColumn } = msg.anchor;

            // Standard interval overlap check
            if (editStartLine <= endLine && editEndLine >= startLine) {
              // Boundary line column check
              if (editStartLine === endLine && editStartCol > endColumn) continue;
              if (editEndLine === startLine && editEndCol < startColumn) continue;

              dismissMessage(msg.messageId);
            }
          }
        }
      }
    );

    return () => disposable.dispose();
  }, [messages, activeTabPath, dismissMessage]);

  // -------------------------------------------------------------------------
  // Callbacks
  // -------------------------------------------------------------------------

  const handleExplain = useCallback(
    (payload: ExplainPayload) => {
      void send('user:explain', payload);
    },
    [send]
  );

  // -------------------------------------------------------------------------
  // Transform planningResult into sidebar initial state
  // -------------------------------------------------------------------------

  const initialIssueContext: IssueContext | null = planningResult
    ? {
        number: planningResult.issueContext.number,
        title: planningResult.issueContext.title,
        url: planningResult.issueContext.url,
        labels: planningResult.issueContext.labels.map((name) => ({ name, color: '#6b6960' })),
      }
    : null;

  const initialPhases: Phase[] | null = planningResult
    ? planningResult.plan.phases.map((phase) => ({
        number: phase.number as 1 | 2 | 3 | 4 | 5,
        title: phase.title,
        status: phase.status as 'pending' | 'active' | 'complete',
        summary: phase.description,
        steps: phase.tasks.map((task) => ({ title: task.title, description: task.description })),
      }))
    : null;

  // -------------------------------------------------------------------------
  // Computed widths
  // -------------------------------------------------------------------------

  const leftWidth = leftCollapsed ? SIDEBAR_LEFT_COLLAPSED : SIDEBAR_LEFT_EXPANDED;
  const rightWidth = rightCollapsed ? SIDEBAR_RIGHT_COLLAPSED : SIDEBAR_RIGHT_EXPANDED;

  return (
    <main
      style={{
        display: 'flex',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--bg-base)',
      }}
      aria-label="IDE workspace"
    >
      {/* Left Sidebar: File Explorer */}
      <motion.nav
        aria-label="File explorer"
        style={{
          height: '100%',
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          flexShrink: 0,
        }}
        animate={{ width: leftWidth }}
        transition={{ type: 'spring', ...SPRING_STANDARD }}
      >
        <div style={sidebarHeaderStyle}>
          {!leftCollapsed && <span style={sidebarLabelStyle}>Explorer</span>}
          <button
            style={collapseButtonStyle}
            onClick={() => setLeftCollapsed((prev) => !prev)}
            aria-label={leftCollapsed ? 'Expand file explorer' : 'Collapse file explorer'}
            title={leftCollapsed ? 'Expand' : 'Collapse'}
          >
            {leftCollapsed ? '\u25B6' : '\u25C0'}
          </button>
        </div>
        {!leftCollapsed && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <FileTree
              tree={tree}
              hints={hintsMap}
              onFileClick={openFile}
              activeFilePath={activeTabPath}
              autoExpandPaths={autoExpandPaths}
            />
          </div>
        )}
      </motion.nav>

      {/* Center: Editor + Status Bar + Terminal */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {/* Editor area: tabs + editor + floating button */}
        <div
          style={{
            ...editorAreaStyle,
            flex: terminalHidden ? 1 : 7,
          }}
        >
          <EditorTabs />
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
            <CodeEditor editorInstanceRef={editorInstanceRef} onEditorReady={handleEditorReady} />
            {activeTabPath !== undefined && (
              <FloatingExplainButton
                editor={editorInstance}
                path={activeTabPath}
                onExplain={handleExplain}
              />
            )}
            <CoachingOverlay
              messages={messages}
              hintLevel={hintLevel}
              expandedIds={expandedIds}
              activeFilePath={activeTabPath}
              editor={editorInstance}
              onDismiss={dismissMessage}
              onExpand={expandMessage}
              focusedMessageId={focusedMessageId}
            />
          </div>
        </div>

        {/* Status bar */}
        <StatusBar />

        {/* Terminal area */}
        {!terminalHidden && (
          <div
            style={{
              flex: 3,
              background: 'var(--bg-inset)',
              borderTop: '1px solid var(--border-subtle)',
              overflow: 'hidden',
              minHeight: 0,
            }}
          >
            <TerminalPanel cwd={planningResult?.repoPath} />
          </div>
        )}
      </div>

      {/* Right Sidebar: Coaching */}
      <motion.aside
        aria-label="Coaching panel"
        style={{
          height: '100%',
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          flexShrink: 0,
        }}
        animate={{ width: rightWidth }}
        transition={{ type: 'spring', ...SPRING_STANDARD }}
      >
        <div style={sidebarHeaderStyle}>
          <button
            style={collapseButtonStyle}
            onClick={() => setRightCollapsed((prev) => !prev)}
            aria-label={rightCollapsed ? 'Expand coaching sidebar' : 'Collapse coaching sidebar'}
            title={rightCollapsed ? 'Expand' : 'Collapse'}
          >
            {rightCollapsed ? '\u25C0' : '\u25B6'}
          </button>
          {!rightCollapsed && <span style={sidebarLabelStyle}>Coaching</span>}
        </div>
        {!rightCollapsed && (
          <CoachingSidebar
            initialIssueContext={initialIssueContext}
            initialPhases={initialPhases}
            onNavigate={onNavigate}
          />
        )}
      </motion.aside>

      {/* Toast container for unanchored coaching messages */}
      <CoachingToastContainer />
    </main>
  );
}
