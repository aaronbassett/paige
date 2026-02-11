/**
 * CodeEditor — Monaco Editor wrapper for the Paige IDE.
 *
 * Wraps @monaco-editor/react with the Paige Dark theme, integrates with
 * the singleton editorState service for tab/content management, and renders
 * a figlet-style "PAIGE" splash when no file is open.
 *
 * Configuration:
 *   - No minimap
 *   - Line numbers on
 *   - Word wrap off
 *   - JetBrains Mono font, 14px
 *   - Smooth cursor, glyph margin enabled
 *
 * The component subscribes to editorState via useSyncExternalStore and
 * re-renders when the active tab or content changes.
 */

import { useCallback, useRef, useSyncExternalStore } from 'react';
import MonacoEditor from '@monaco-editor/react';
import type { OnMount, BeforeMount, OnChange } from '@monaco-editor/react';
import type { editor as MonacoEditorNS } from 'monaco-editor';
import { registerPaigeDarkTheme, PAIGE_DARK_THEME } from '../../utils/theme';
import { editorState } from '../../services/editor-state';
import type { TabState } from '@shared/types/entities';

// ---------------------------------------------------------------------------
// Monaco editor options (static — never changes between renders)
// ---------------------------------------------------------------------------

const EDITOR_OPTIONS: MonacoEditorNS.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: false },
  lineNumbers: 'on',
  wordWrap: 'off',
  fontSize: 14,
  fontFamily: "'JetBrains Mono', monospace",
  scrollBeyondLastLine: false,
  renderLineHighlight: 'line',
  cursorBlinking: 'smooth',
  cursorStyle: 'line',
  smoothScrolling: true,
  glyphMargin: true,
};

// ---------------------------------------------------------------------------
// Empty state — figlet-style ASCII "PAIGE"
// ---------------------------------------------------------------------------

const PAIGE_ASCII = `
 ____   _    ___ ____ _____
|  _ \\ / \\  |_ _/ ___| ____|
| |_) / _ \\  | | |  _|  _|
|  __/ ___ \\ | | |_| | |___
|_| /_/   \\_\\___|\\____|_____|
`.trimStart();

const emptyStateContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  width: '100%',
  background: 'var(--bg-inset)',
  userSelect: 'none',
};

const asciiArtStyle: React.CSSProperties = {
  color: 'var(--accent-primary)',
  fontFamily: 'var(--font-family), monospace',
  fontSize: '16px',
  lineHeight: 1.2,
  whiteSpace: 'pre',
  textAlign: 'center',
  margin: 0,
};

const subtitleStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-family), monospace',
  fontSize: 'var(--font-small-size)',
  marginTop: 'var(--space-md)',
};

// ---------------------------------------------------------------------------
// Editor container style
// ---------------------------------------------------------------------------

const editorContainerStyle: React.CSSProperties = {
  height: '100%',
  width: '100%',
};

// ---------------------------------------------------------------------------
// Subscription helpers for useSyncExternalStore
// ---------------------------------------------------------------------------

function subscribeToEditorState(callback: () => void): () => void {
  return editorState.subscribe(callback);
}

function getActiveTab(): TabState | undefined {
  return editorState.getActiveTab();
}

function getActiveTabPath(): string | undefined {
  return editorState.getActiveTabPath();
}

// ---------------------------------------------------------------------------
// EmptyState sub-component
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div style={emptyStateContainerStyle} role="status" aria-label="No file open">
      <pre className="figlet-header" style={asciiArtStyle}>
        {PAIGE_ASCII}
      </pre>
      <p style={subtitleStyle}>Open a file to start coding</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CodeEditor component
// ---------------------------------------------------------------------------

export function CodeEditor() {
  // Refs for the Monaco editor and monaco namespace instances
  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);

  // Subscribe to editor state changes
  const activeTab = useSyncExternalStore(subscribeToEditorState, getActiveTab);
  const activeTabPath = useSyncExternalStore(subscribeToEditorState, getActiveTabPath);

  // Derive content from the active tab
  const content = activeTabPath !== undefined ? editorState.getContent(activeTabPath) : undefined;

  // -------------------------------------------------------------------------
  // beforeMount: register Paige Dark theme
  // -------------------------------------------------------------------------

  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    registerPaigeDarkTheme(monaco);
  }, []);

  // -------------------------------------------------------------------------
  // onMount: store references, attach cursor listener
  // -------------------------------------------------------------------------

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Track cursor position changes
    editor.onDidChangeCursorPosition((e) => {
      const currentPath = editorState.getActiveTabPath();
      if (currentPath !== undefined) {
        editorState.updateCursor(currentPath, {
          line: e.position.lineNumber,
          column: e.position.column,
        });
      }
    });

    // Focus the editor on mount
    editor.focus();
  }, []);

  // -------------------------------------------------------------------------
  // onChange: update content and mark dirty
  // -------------------------------------------------------------------------

  const handleChange: OnChange = useCallback((value) => {
    const currentPath = editorState.getActiveTabPath();
    if (currentPath === undefined) {
      return;
    }

    const newContent = value ?? '';
    editorState.setContent(currentPath, newContent);
    editorState.setDirty(currentPath, newContent);
  }, []);

  // -------------------------------------------------------------------------
  // Render: empty state or Monaco editor
  // -------------------------------------------------------------------------

  if (activeTab === undefined) {
    return <EmptyState />;
  }

  return (
    <div style={editorContainerStyle}>
      <MonacoEditor
        language={activeTab.language}
        value={content ?? ''}
        path={activeTab.path}
        theme={PAIGE_DARK_THEME}
        options={EDITOR_OPTIONS}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        onChange={handleChange}
        loading={
          <div style={emptyStateContainerStyle}>
            <p style={subtitleStyle}>Loading editor...</p>
          </div>
        }
      />
    </div>
  );
}
