/**
 * CodeEditor -- Monaco Editor wrapper for the Paige IDE.
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
 * Edge cases:
 *   - **Binary files**: Content containing null bytes renders a fallback
 *     message instead of the Monaco editor.
 *   - **Deleted files**: Content matching the sentinel value set by
 *     useFileOperations renders a "file deleted" banner.
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
// Sentinel value used by useFileOperations to mark a deleted file
// ---------------------------------------------------------------------------

export const FILE_DELETED_SENTINEL = '__PAIGE_FILE_DELETED__';

// ---------------------------------------------------------------------------
// Binary detection
// ---------------------------------------------------------------------------

/**
 * Detect whether a string appears to contain binary content.
 *
 * Uses two heuristics:
 *  1. Presence of the null character (\0) anywhere in the string.
 *  2. A high ratio (>10 %) of non-printable control characters in the
 *     first 8 KB of the content.
 *
 * These checks are fast and handle the common cases (images, compiled
 * binaries, compressed archives) without false-positiving on normal
 * source files that happen to include unusual Unicode.
 */
export function isBinaryContent(content: string): boolean {
  if (content.length === 0) {
    return false;
  }

  // Fast check: null bytes are almost never found in text files
  if (content.includes('\0')) {
    return true;
  }

  // Heuristic: count non-printable control chars in the first 8 KB.
  // Printable ASCII is 0x20-0x7E, plus common whitespace (tab, LF, CR).
  const sampleSize = Math.min(content.length, 8192);
  let controlCount = 0;
  for (let i = 0; i < sampleSize; i++) {
    const code = content.charCodeAt(i);
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
      controlCount++;
    }
  }

  return controlCount / sampleSize > 0.1;
}

// ---------------------------------------------------------------------------
// Monaco editor options (static -- never changes between renders)
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
// Empty state -- figlet-style ASCII "PAIGE"
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
// Fallback state styles (binary / deleted)
// ---------------------------------------------------------------------------

const fallbackIconStyle: React.CSSProperties = {
  fontSize: '48px',
  marginBottom: 'var(--space-md)',
};

const fallbackTitleStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-family), monospace',
  fontSize: '16px',
  margin: 0,
};

const fallbackSubtitleStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-family), monospace',
  fontSize: 'var(--font-small-size)',
  marginTop: 'var(--space-xs)',
};

// ---------------------------------------------------------------------------
// Editor container style
// ---------------------------------------------------------------------------

const editorContainerStyle: React.CSSProperties = {
  height: '100%',
  width: '100%',
  position: 'relative',
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
// Sub-components
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

function BinaryFileFallback({ path }: { path: string }) {
  const filename = path.split('/').pop() ?? path;
  return (
    <div style={emptyStateContainerStyle} role="status" aria-label="Binary file">
      <span style={fallbackIconStyle}>&#x1F6AB;</span>
      <p style={fallbackTitleStyle}>Binary file -- cannot display</p>
      <p style={fallbackSubtitleStyle}>{filename}</p>
    </div>
  );
}

function DeletedFileFallback({ path }: { path: string }) {
  const filename = path.split('/').pop() ?? path;
  return (
    <div style={emptyStateContainerStyle} role="alert" aria-label="File deleted">
      <span style={fallbackIconStyle}>&#x1F5D1;</span>
      <p style={fallbackTitleStyle}>File has been deleted</p>
      <p style={fallbackSubtitleStyle}>{filename} is no longer available on disk</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CodeEditorProps {
  /**
   * Ref forwarded to the caller so external components (e.g.
   * FloatingExplainButton) can access the Monaco editor instance.
   */
  editorInstanceRef?: React.MutableRefObject<MonacoEditorNS.IStandaloneCodeEditor | null>;
  /** Called when the Monaco editor instance is ready. */
  onEditorReady?: (editor: MonacoEditorNS.IStandaloneCodeEditor) => void;
}

// ---------------------------------------------------------------------------
// CodeEditor component
// ---------------------------------------------------------------------------

export function CodeEditor({ editorInstanceRef, onEditorReady }: CodeEditorProps) {
  // Internal ref -- always maintained
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

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      // Sync the external ref if provided
      if (editorInstanceRef) {
        editorInstanceRef.current = editor;
      }

      // Notify parent that the editor is ready
      onEditorReady?.(editor);

      // Override Monaco's default no-op Cmd+S / Cmd+W with custom actions
      // that dispatch events useFileOperations can handle. Without this,
      // Monaco consumes the keystroke (preventDefault + stopPropagation)
      // and the window-level keydown listener never fires.
      editor.addAction({
        id: 'paige-save',
        label: 'Save',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        run: () => {
          window.dispatchEvent(new Event('paige:save'));
        },
      });

      editor.addAction({
        id: 'paige-close-tab',
        label: 'Close Tab',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW],
        run: () => {
          window.dispatchEvent(new Event('paige:close-tab'));
        },
      });

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
    },
    [editorInstanceRef, onEditorReady]
  );

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
  // Render: empty state, fallbacks, or Monaco editor
  // -------------------------------------------------------------------------

  if (activeTab === undefined) {
    return <EmptyState />;
  }

  // Check for deleted file sentinel
  if (content === FILE_DELETED_SENTINEL) {
    return <DeletedFileFallback path={activeTab.path} />;
  }

  // Check for binary content
  if (content !== undefined && isBinaryContent(content)) {
    return <BinaryFileFallback path={activeTab.path} />;
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
