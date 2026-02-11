/**
 * FloatingExplainButton — appears above-right of a text selection in the
 * Monaco editor. Clicking it sends a `user:explain` WebSocket message
 * with the selected file path, range, and text.
 *
 * Visibility rules:
 *  - Shown when the user selects 2+ characters of text.
 *  - Hidden when selection is empty, <2 chars, or the editor scrolls.
 *  - Re-shown after scroll settles if the selection still exists.
 *  - Hidden after the button is clicked.
 *
 * Positioning:
 *  - Absolute, relative to the editor container DOM element.
 *  - Clamped so the button never overflows above the container.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { editor as monacoEditor } from 'monaco-editor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Range payload matching InlineCodeRange from the WebSocket protocol. */
interface ExplainRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

/** Payload sent to the onExplain callback. */
export interface ExplainPayload {
  path: string;
  range: ExplainRange;
  text: string;
}

export interface FloatingExplainButtonProps {
  /** Monaco editor instance to track selections on. */
  editorRef: React.RefObject<monacoEditor.IStandaloneCodeEditor | null>;
  /** Current file path displayed in the editor. */
  path: string;
  /** Called when the user clicks "Explain". */
  onExplain: (payload: ExplainPayload) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum characters in a selection before the button appears. */
const MIN_SELECTION_LENGTH = 2;

/** Milliseconds to wait after a scroll event before re-showing the button. */
const SCROLL_SETTLE_MS = 250;

/** Vertical offset above the selection start position (px). */
const BUTTON_OFFSET_Y = 4;

/** Horizontal offset to the right of the selection start position (px). */
const BUTTON_OFFSET_X = 8;

/** Minimum top position to avoid clipping above the editor container. */
const MIN_TOP = 0;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const buttonStyle: React.CSSProperties = {
  position: 'absolute',
  zIndex: 10,
  background: 'var(--accent-terracotta, #d97757)',
  color: '#ffffff',
  borderRadius: '4px',
  padding: '4px 8px',
  fontSize: 'var(--font-small-size, 12px)',
  fontFamily: 'var(--font-family, monospace), monospace',
  fontWeight: 500,
  cursor: 'pointer',
  border: 'none',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
  userSelect: 'none',
  pointerEvents: 'auto',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FloatingExplainButton({
  editorRef,
  path,
  onExplain,
}: FloatingExplainButtonProps): React.ReactElement | null {
  const [visible, setVisible] = useState(false);
  const [opacity, setOpacity] = useState(0);
  const [top, setTop] = useState(0);
  const [left, setLeft] = useState(0);

  /** Cached selection data so we can send it on click. */
  const selectionRef = useRef<{
    range: ExplainRange;
    text: string;
  } | null>(null);

  /** Timer used to re-show the button after a scroll settles. */
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Compute the absolute position of the button relative to the editor
   * container element. Returns null if the position cannot be determined.
   */
  const computePosition = useCallback(
    (
      editorInstance: monacoEditor.IStandaloneCodeEditor,
      startLineNumber: number,
      startColumn: number
    ): { top: number; left: number } | null => {
      // getScrolledVisiblePosition gives coordinates relative to the
      // editor's DOM node, accounting for scroll position.
      const pos = editorInstance.getScrolledVisiblePosition({
        lineNumber: startLineNumber,
        column: startColumn,
      });

      if (!pos) {
        return null;
      }

      const computedTop = Math.max(MIN_TOP, pos.top - pos.height - BUTTON_OFFSET_Y);
      const computedLeft = pos.left + BUTTON_OFFSET_X;

      return { top: computedTop, left: computedLeft };
    },
    []
  );

  /**
   * Evaluate the current selection and either show or hide the button.
   * Called from both the selection-change listener and after scroll settles.
   */
  const evaluateSelection = useCallback(
    (editorInstance: monacoEditor.IStandaloneCodeEditor) => {
      const selection = editorInstance.getSelection();
      if (!selection || selection.isEmpty()) {
        selectionRef.current = null;
        setOpacity(0);
        // Allow the fade-out transition to complete before unmounting
        setTimeout(() => setVisible(false), 160);
        return;
      }

      const model = editorInstance.getModel();
      if (!model) {
        return;
      }

      const selectedText = model.getValueInRange(selection);
      if (selectedText.length < MIN_SELECTION_LENGTH) {
        selectionRef.current = null;
        setOpacity(0);
        setTimeout(() => setVisible(false), 160);
        return;
      }

      // Cache the selection data for the click handler
      selectionRef.current = {
        range: {
          startLine: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLine: selection.endLineNumber,
          endColumn: selection.endColumn,
        },
        text: selectedText,
      };

      const position = computePosition(
        editorInstance,
        selection.startLineNumber,
        selection.startColumn
      );
      if (!position) {
        return;
      }

      setTop(position.top);
      setLeft(position.left);
      setVisible(true);
      // Trigger fade-in on next frame so the transition plays
      requestAnimationFrame(() => setOpacity(1));
    },
    [computePosition]
  );

  // -------------------------------------------------------------------------
  // Effect: subscribe to Monaco selection changes and scroll events
  // -------------------------------------------------------------------------

  useEffect(() => {
    const editorInstance = editorRef.current;
    if (!editorInstance) {
      return;
    }

    // --- Selection change ---
    const selectionDisposable = editorInstance.onDidChangeCursorSelection(() => {
      evaluateSelection(editorInstance);
    });

    // --- Scroll: hide immediately, re-evaluate after settle ---
    const scrollDisposable = editorInstance.onDidScrollChange(() => {
      // Hide button during scroll
      setOpacity(0);

      if (scrollTimerRef.current !== null) {
        clearTimeout(scrollTimerRef.current);
      }

      scrollTimerRef.current = setTimeout(() => {
        scrollTimerRef.current = null;
        evaluateSelection(editorInstance);
      }, SCROLL_SETTLE_MS);
    });

    return () => {
      selectionDisposable.dispose();
      scrollDisposable.dispose();

      if (scrollTimerRef.current !== null) {
        clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = null;
      }
    };
  }, [editorRef, evaluateSelection]);

  // -------------------------------------------------------------------------
  // Click handler
  // -------------------------------------------------------------------------

  const handleClick = useCallback(() => {
    if (!selectionRef.current) {
      return;
    }

    onExplain({
      path,
      range: selectionRef.current.range,
      text: selectionRef.current.text,
    });

    // Hide after click
    selectionRef.current = null;
    setOpacity(0);
    setTimeout(() => setVisible(false), 160);
  }, [path, onExplain]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (!visible) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label="Explain selected code"
      style={{
        ...buttonStyle,
        top,
        left,
        opacity,
        transition: 'opacity 150ms ease',
      }}
      onClick={handleClick}
    >
      Explain
    </button>
  );
}
