/**
 * CoachingOverlay -- Renders anchored coaching messages over the Monaco editor.
 *
 * Positioned absolutely within the editor container (which must have
 * `position: relative`). Each anchored coaching message is rendered as either:
 *   - A full CommentBalloon (explain/observer source, expanded, or hint level >= 2)
 *   - A CollapsedIcon (coaching source at hint levels 0-1, not expanded)
 *
 * Uses Monaco's `getScrolledVisiblePosition()` to compute pixel positions for
 * each anchor, and recomputes on editor scroll via `onDidScrollChange`.
 *
 * Usage:
 * ```tsx
 * <div style={{ position: 'relative' }}>
 *   <MonacoEditor ref={editorRef} ... />
 *   <CoachingOverlay
 *     messages={anchoredMessages}
 *     hintLevel={hintLevel}
 *     expandedIds={expandedIds}
 *     activeFilePath={activeFilePath}
 *     editor={editorInstance}
 *     onDismiss={dismissMessage}
 *     onExpand={expandMessage}
 *   />
 * </div>
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { CommentBalloon } from './CommentBalloon';
import { CollapsedIcon } from './CollapsedIcon';
import type { CoachingMessage, HintLevel } from '@shared/types/entities';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Monaco editor type (narrowed to the methods we actually use). */
export interface MonacoEditorLike {
  getScrolledVisiblePosition(position: {
    lineNumber: number;
    column: number;
  }): { top: number; left: number; height: number } | null;
  onDidScrollChange(listener: () => void): { dispose(): void };
}

export interface CoachingOverlayProps {
  /** All active coaching messages (filtered to those with anchors). */
  messages: CoachingMessage[];
  /** Current hint level (0-3). */
  hintLevel: HintLevel;
  /** Set of manually expanded message IDs. */
  expandedIds: ReadonlySet<string>;
  /** Active file path currently shown in editor. */
  activeFilePath: string | undefined;
  /** Monaco editor instance for computing anchor positions (pass value, not ref). */
  editor: MonacoEditorLike | null;
  /** Callback when a message is dismissed. */
  onDismiss: (messageId: string) => void;
  /** Callback when a collapsed icon is expanded. */
  onExpand: (messageId: string) => void;
  /** Optional: currently focused review messageId (for emphasis). */
  focusedMessageId?: string;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface AnchorPosition {
  top: number;
  left: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  pointerEvents: 'none',
  zIndex: 50,
};

const anchorRefStyle = (pos: AnchorPosition): React.CSSProperties => ({
  position: 'absolute',
  top: pos.top,
  left: pos.left,
  width: 1,
  height: pos.height,
  pointerEvents: 'auto',
});

// ---------------------------------------------------------------------------
// Sub-component for a single anchored message
// ---------------------------------------------------------------------------

interface AnchoredMessageItemProps {
  msg: CoachingMessage;
  position: AnchorPosition;
  shouldShowBalloon: boolean;
  emphasized: boolean;
  onDismiss: (messageId: string) => void;
  onExpand: (messageId: string) => void;
}

/**
 * Renders a single anchored coaching message with its reference div.
 * Uses state to track the reference element so floating-ui can position
 * against it without reading a ref during render.
 */
function AnchoredMessageItem({
  msg,
  position,
  shouldShowBalloon,
  emphasized,
  onDismiss,
  onExpand,
}: AnchoredMessageItemProps): React.ReactElement {
  const [refEl, setRefEl] = useState<HTMLDivElement | null>(null);

  const refCallback = useCallback((node: HTMLDivElement | null) => {
    setRefEl(node);
  }, []);

  return (
    <div>
      {/* Invisible reference element positioned at the anchor */}
      <div
        ref={refCallback}
        style={anchorRefStyle(position)}
        data-testid={`anchor-ref-${msg.messageId}`}
      />

      {shouldShowBalloon ? (
        <CommentBalloon
          message={msg.message}
          type={msg.type}
          messageId={msg.messageId}
          referenceElement={refEl}
          onClose={onDismiss}
          emphasized={emphasized}
        />
      ) : (
        <CollapsedIcon
          messageId={msg.messageId}
          type={msg.type}
          referenceElement={refEl}
          onExpand={onExpand}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CoachingOverlay({
  messages,
  hintLevel,
  expandedIds,
  activeFilePath,
  editor,
  onDismiss,
  onExpand,
  focusedMessageId,
}: CoachingOverlayProps): React.ReactElement | null {
  // Positions computed in an effect from the Monaco editor instance.
  // Map of messageId -> AnchorPosition (or null if off-screen).
  const [positions, setPositions] = useState<Map<string, AnchorPosition>>(
    () => new Map(),
  );

  // Filter to messages anchored to the active file
  const activeMessages = messages.filter(
    (m) => m.anchor && m.anchor.path === activeFilePath,
  );

  // -------------------------------------------------------------------------
  // Compute positions and subscribe to editor scroll changes
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!editor) {
      setPositions(new Map());
      return;
    }

    function computePositions(): void {
      const next = new Map<string, AnchorPosition>();
      for (const msg of activeMessages) {
        const anchor = msg.anchor!;
        const pos = editor!.getScrolledVisiblePosition({
          lineNumber: anchor.startLine,
          column: anchor.endColumn,
        });
        if (pos) {
          next.set(msg.messageId, pos);
        }
      }
      setPositions(next);
    }

    computePositions();

    const disposable = editor.onDidScrollChange(() => {
      computePositions();
    });

    return () => {
      disposable.dispose();
    };
    // We intentionally depend on activeMessages by serializing the message IDs
    // to avoid object identity issues. The positions must recompute whenever
    // the set of visible messages or the editor changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, activeMessages.map((m) => m.messageId).join(',')]);

  // -------------------------------------------------------------------------
  // Early return if nothing to render
  // -------------------------------------------------------------------------

  if (activeMessages.length === 0 || !editor) {
    return null;
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div style={overlayStyle} data-testid="coaching-overlay">
      {activeMessages.map((msg) => {
        const pos = positions.get(msg.messageId);
        if (!pos) return null;

        // Determine rendering mode
        const shouldShowBalloon =
          msg.source === 'explain' ||
          msg.source === 'observer' ||
          expandedIds.has(msg.messageId) ||
          hintLevel >= 2;

        return (
          <AnchoredMessageItem
            key={msg.messageId}
            msg={msg}
            position={pos}
            shouldShowBalloon={shouldShowBalloon}
            emphasized={focusedMessageId === msg.messageId}
            onDismiss={onDismiss}
            onExpand={onExpand}
          />
        );
      })}
    </div>
  );
}
