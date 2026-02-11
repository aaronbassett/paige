/**
 * Decoration manager for the Paige Electron UI.
 *
 * Manages Monaco editor decorations (line highlights, gutter markers, squiggly
 * underlines) that are driven by the backend via WebSocket. Stores decorations
 * per file path, filters by hint level, detects range overlaps for
 * auto-dismissal, and converts to Monaco IModelDeltaDecoration format.
 *
 * This service owns the decoration data but does NOT import monaco-editor
 * directly. Monaco is loaded dynamically by the editor component at runtime.
 * Instead, we return plain objects that match Monaco's IModelDeltaDecoration
 * shape so the editor component can pass them straight to deltaDecorations().
 */

import type {
  EditorDecoration,
  DecorationType,
  DecorationStyle,
  CodeRange,
} from '@shared/types/entities';

// ---------------------------------------------------------------------------
// Monaco-compatible types (mirrors IModelDeltaDecoration without importing)
// ---------------------------------------------------------------------------

/**
 * Matches Monaco's IModelDecorationOptions shape.
 * Only the subset of fields we actually use is defined here.
 */
export interface MonacoDecorationOptions {
  className?: string;
  isWholeLine?: boolean;
  glyphMarginClassName?: string;
  hoverMessage?: { value: string };
}

/**
 * Matches Monaco's IRange shape.
 * Monaco uses 1-indexed line/column values.
 */
export interface MonacoRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

/**
 * Matches Monaco's IModelDeltaDecoration shape.
 * These objects can be passed directly to editor.deltaDecorations().
 */
export interface MonacoDeltaDecoration {
  range: MonacoRange;
  options: MonacoDecorationOptions;
}

// ---------------------------------------------------------------------------
// Decoration type + style to Monaco options mapping
// ---------------------------------------------------------------------------

/**
 * Composite key for the decoration options lookup table.
 * Format: `${DecorationType}:${DecorationStyle}`
 */
type DecorationKey = `${DecorationType}:${DecorationStyle}`;

/**
 * Maps every (type, style) pair to its Monaco decoration options.
 * Line highlights are whole-line, gutter markers use the glyph margin,
 * and squiggly underlines use inline class names.
 */
const DECORATION_OPTIONS: Record<DecorationKey, MonacoDecorationOptions> = {
  // Line highlights
  'line-highlight:hint': { className: 'hint-highlight', isWholeLine: true },
  'line-highlight:error': { className: 'error-highlight', isWholeLine: true },
  'line-highlight:warning': { className: 'warning-highlight', isWholeLine: true },
  'line-highlight:success': { className: 'success-highlight', isWholeLine: true },

  // Gutter markers
  'gutter-marker:hint': { glyphMarginClassName: 'hint-gutter' },
  'gutter-marker:error': { glyphMarginClassName: 'error-gutter' },
  'gutter-marker:warning': { glyphMarginClassName: 'warning-gutter' },
  'gutter-marker:success': { glyphMarginClassName: 'success-gutter' },

  // Squiggly underlines
  'squiggly:hint': { className: 'hint-squiggly' },
  'squiggly:error': { className: 'error-squiggly' },
  'squiggly:warning': { className: 'warning-squiggly' },
  'squiggly:success': { className: 'success-squiggly' },
};

// ---------------------------------------------------------------------------
// Overlap detection
// ---------------------------------------------------------------------------

/**
 * Determine whether two code ranges overlap.
 *
 * Two ranges overlap when:
 *   edit.startLine <= range.endLine AND edit.endLine >= range.startLine
 *
 * On boundary lines (where one range starts on the same line the other ends),
 * we additionally compare columns to avoid false positives when the ranges
 * are adjacent but non-overlapping on the same line.
 */
function rangesOverlap(a: CodeRange, b: CodeRange): boolean {
  // No overlap if entirely above or entirely below
  if (a.endLine < b.startLine || a.startLine > b.endLine) {
    return false;
  }

  // If the ranges share only a boundary line, verify column overlap.
  // Case: a ends on the same line b starts — overlap only if a extends past b's start column.
  if (a.endLine === b.startLine && a.endColumn < b.startColumn) {
    return false;
  }

  // Case: b ends on the same line a starts — overlap only if b extends past a's start column.
  if (b.endLine === a.startLine && b.endColumn < a.startColumn) {
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// DecorationManager
// ---------------------------------------------------------------------------

/**
 * Manages editor decorations for all open files.
 *
 * Decorations are keyed by file path and filtered by the user's current
 * hint level before being converted to Monaco's IModelDeltaDecoration shape.
 *
 * Usage flow:
 * 1. Backend sends `decoration:set` via WebSocket with a list of EditorDecoration items.
 * 2. The WebSocket handler calls `setDecorations(path, decorations)` to store them.
 * 3. The editor component calls `getDecorationsForFile(path, hintLevel)` to get
 *    the visible subset, then `toMonacoDecorations()` to convert for deltaDecorations().
 * 4. When the user edits a range, `removeOverlapping(path, editRange)` is called
 *    to auto-dismiss decorations whose range intersects the edit.
 */
class DecorationManager {
  /** Decorations indexed by file path. */
  private decorationsByPath = new Map<string, EditorDecoration[]>();

  // -------------------------------------------------------------------------
  // Storage
  // -------------------------------------------------------------------------

  /**
   * Store (replace) the full set of decorations for a file.
   *
   * @param path - Absolute file path.
   * @param decorations - Complete decoration list from the backend.
   */
  setDecorations(path: string, decorations: EditorDecoration[]): void {
    if (decorations.length === 0) {
      this.decorationsByPath.delete(path);
    } else {
      this.decorationsByPath.set(path, [...decorations]);
    }
  }

  /**
   * Return decorations for a file, filtered to those at or below the
   * given hint level.
   *
   * Hint levels form a progressive disclosure scale:
   *   0 = no hints, 1 = subtle, 2 = moderate, 3 = explicit
   *
   * A decoration with `level: 2` is visible when hintLevel >= 2.
   *
   * @param path - Absolute file path.
   * @param hintLevel - Current user hint level (0-3).
   * @returns Filtered decorations. Empty array if no decorations exist.
   */
  getDecorationsForFile(path: string, hintLevel: number): EditorDecoration[] {
    const decorations = this.decorationsByPath.get(path);
    if (!decorations) {
      return [];
    }
    return decorations.filter((d) => d.level <= hintLevel);
  }

  /**
   * Get all stored file paths that have decorations.
   */
  getDecoratedPaths(): string[] {
    return Array.from(this.decorationsByPath.keys());
  }

  // -------------------------------------------------------------------------
  // Clearing
  // -------------------------------------------------------------------------

  /** Clear all decorations for a specific file. */
  clearDecorations(path: string): void {
    this.decorationsByPath.delete(path);
  }

  /** Clear all decorations across all files. */
  clearAll(): void {
    this.decorationsByPath.clear();
  }

  // -------------------------------------------------------------------------
  // Overlap detection & auto-dismissal
  // -------------------------------------------------------------------------

  /**
   * Find decoration IDs that overlap the given edit range.
   *
   * @param path - File path that was edited.
   * @param editRange - The range of the edit operation.
   * @returns Array of decoration IDs whose ranges overlap the edit.
   */
  checkOverlap(path: string, editRange: CodeRange): string[] {
    const decorations = this.decorationsByPath.get(path);
    if (!decorations) {
      return [];
    }
    return decorations
      .filter((d) => rangesOverlap(editRange, d.range))
      .map((d) => d.id);
  }

  /**
   * Remove decorations that overlap the given edit range (auto-dismissal).
   *
   * When the user edits code in a region that has coaching decorations,
   * those decorations are assumed to be addressed and are removed.
   *
   * @param path - File path that was edited.
   * @param editRange - The range of the edit operation.
   * @returns Array of removed decoration IDs (useful for notifying the backend).
   */
  removeOverlapping(path: string, editRange: CodeRange): string[] {
    const decorations = this.decorationsByPath.get(path);
    if (!decorations) {
      return [];
    }

    const removedIds: string[] = [];
    const remaining: EditorDecoration[] = [];

    for (const decoration of decorations) {
      if (rangesOverlap(editRange, decoration.range)) {
        removedIds.push(decoration.id);
      } else {
        remaining.push(decoration);
      }
    }

    if (removedIds.length > 0) {
      if (remaining.length === 0) {
        this.decorationsByPath.delete(path);
      } else {
        this.decorationsByPath.set(path, remaining);
      }
    }

    return removedIds;
  }

  // -------------------------------------------------------------------------
  // Monaco conversion
  // -------------------------------------------------------------------------

  /**
   * Convert EditorDecoration items to Monaco IModelDeltaDecoration-compatible objects.
   *
   * The returned objects can be passed directly to `editor.deltaDecorations(oldIds, newDecorations)`.
   * Each decoration is mapped using the (type, style) lookup table and includes a
   * hover message if the original decoration has a message string.
   *
   * @param decorations - The decorations to convert (typically from getDecorationsForFile).
   * @returns Array of Monaco-compatible delta decoration objects.
   */
  toMonacoDecorations(decorations: EditorDecoration[]): MonacoDeltaDecoration[] {
    return decorations.map((d) => {
      const key: DecorationKey = `${d.type}:${d.style}`;
      const baseOptions = DECORATION_OPTIONS[key];

      const options: MonacoDecorationOptions = { ...baseOptions };
      if (d.message) {
        options.hoverMessage = { value: d.message };
      }

      return {
        range: {
          startLineNumber: d.range.startLine,
          startColumn: d.range.startColumn,
          endLineNumber: d.range.endLine,
          endColumn: d.range.endColumn,
        },
        options,
      };
    });
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/** Singleton decoration manager instance for the application. */
export const decorationManager = new DecorationManager();

export { DecorationManager, rangesOverlap };
