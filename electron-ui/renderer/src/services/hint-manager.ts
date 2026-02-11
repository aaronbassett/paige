/**
 * Hint manager service for the Paige Electron UI.
 *
 * Singleton service that manages file explorer hint glows. When the backend
 * sends explorer hints (via WebSocket), this service computes which file paths
 * and directory paths should glow, at what intensity, and with what spring
 * animation parameters.
 *
 * React components subscribe to state changes via the listener API and
 * re-render when notified (same pattern as editor-state.ts).
 *
 * This service is the single source of truth for all hint glow state.
 */

import type { ExplorerHint, ExplorerHintStyle } from '@shared/types/entities';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Computed hint information for a single file or directory path. */
export interface HintInfo {
  /** The visual style of the hint glow. */
  style: ExplorerHintStyle;
  /** Opacity intensity, from 0.0 (invisible) to 1.0 (full). */
  intensity: number;
  /** Spring stiffness for the Framer Motion animation. */
  stiffness: number;
  /** Spring damping for the Framer Motion animation. */
  damping: number;
}

/** Listener callback invoked whenever hint state changes. */
export type HintManagerListener = () => void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Intensity gradient for "unmissable" hints. Indexed by the distance
 * (in directory levels) from the hinted file itself.
 *
 * | Distance | Opacity | Stiffness | Damping |
 * |----------|---------|-----------|---------|
 * | 0        | 1.0     | 120       | 14      |
 * | 1        | 0.9     | 140       | 16      |
 * | 2        | 0.7     | 160       | 18      |
 * | 3+       | 0.5     | 180       | 20      |
 */
const UNMISSABLE_GRADIENT: readonly HintInfo[] = [
  { style: 'unmissable', intensity: 1.0, stiffness: 120, damping: 14 },
  { style: 'unmissable', intensity: 0.9, stiffness: 140, damping: 16 },
  { style: 'unmissable', intensity: 0.7, stiffness: 160, damping: 18 },
  { style: 'unmissable', intensity: 0.5, stiffness: 180, damping: 20 },
] as const;

/** Base hint info used for subtle and obvious styles (file-level). */
const BASE_HINT_INFO: Omit<HintInfo, 'style'> = {
  intensity: 1.0,
  stiffness: 120,
  damping: 14,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract all ancestor directory paths from a file path.
 *
 * @example
 * getAncestorPaths('/src/components/Editor/Editor.tsx')
 * // => ['/src', '/src/components', '/src/components/Editor']
 *
 * @param filePath - Absolute file path with forward slashes.
 * @returns Array of ancestor directory paths, from shallowest to deepest.
 */
function getAncestorPaths(filePath: string): string[] {
  const segments = filePath.split('/').filter(Boolean);
  const ancestors: string[] = [];

  // Build up ancestor paths segment by segment, excluding the file itself
  for (let i = 1; i < segments.length; i++) {
    ancestors.push('/' + segments.slice(0, i).join('/'));
  }

  return ancestors;
}

/**
 * Get the top-level directory for a file path (first segment after root).
 *
 * @example
 * getTopLevelDir('/src/components/Editor.tsx') // => '/src'
 */
function getTopLevelDir(filePath: string): string | undefined {
  const segments = filePath.split('/').filter(Boolean);
  if (segments.length < 2) {
    return undefined;
  }
  return '/' + segments[0];
}

/**
 * Look up the gradient entry for an unmissable hint at a given distance.
 * Distances of 3 or more all use the same (dimmest) entry.
 */
function getGradientEntry(distance: number): HintInfo {
  const index = Math.min(distance, UNMISSABLE_GRADIENT.length - 1);
  // The array is readonly and always has 4 entries, so the index is safe.
  return UNMISSABLE_GRADIENT[index]!;
}

// ---------------------------------------------------------------------------
// HintManagerService
// ---------------------------------------------------------------------------

/**
 * Manages file explorer hint glows: computes which paths should glow,
 * at what intensity, and with what spring parameters.
 *
 * @example
 * ```ts
 * import { hintManager } from './services/hint-manager';
 *
 * hintManager.applyHints([
 *   { path: '/src/App.tsx', style: 'unmissable' },
 * ]);
 *
 * const hint = hintManager.getHint('/src/App.tsx');
 * // => { style: 'unmissable', intensity: 1.0, stiffness: 120, damping: 14 }
 *
 * const unsubscribe = hintManager.subscribe(() => {
 *   console.log('Hints changed');
 * });
 * unsubscribe();
 * ```
 */
class HintManagerService {
  /** Map of path to computed hint info. Includes both files and directories. */
  private hints = new Map<string, HintInfo>();

  /** Set of directory paths that should be auto-expanded in the tree. */
  private autoExpandPaths = new Set<string>();

  /** Set of subscribed listeners notified on every state mutation. */
  private listeners = new Set<HintManagerListener>();

  // -------------------------------------------------------------------------
  // Subscription
  // -------------------------------------------------------------------------

  /**
   * Subscribe to hint state changes. The listener is called (with no arguments)
   * whenever hints are applied or cleared. Returns an unsubscribe function.
   *
   * @param listener - Callback invoked on state change.
   * @returns A function that removes the listener when called.
   */
  subscribe(listener: HintManagerListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  /**
   * Apply a new set of hints, replacing any existing hints.
   *
   * Processing logic per hint style:
   * - `subtle`: Only the file itself gets a glow.
   * - `obvious`: The file + backend-specified `directories` array get glows.
   * - `unmissable`: The file + ALL ancestor directories get glows with an
   *   intensity gradient that decreases with distance from the file.
   *
   * When multiple hints affect the same directory, the highest intensity wins.
   *
   * @param hints - Array of explorer hints from the backend.
   */
  applyHints(hints: ExplorerHint[]): void {
    this.hints.clear();
    this.autoExpandPaths.clear();

    for (const hint of hints) {
      this.processHint(hint);
    }

    this.notify();
  }

  /**
   * Clear all hints and auto-expand paths. Resets to the initial empty state.
   */
  clearHints(): void {
    if (this.hints.size === 0 && this.autoExpandPaths.size === 0) {
      return; // Already empty -- skip notification
    }

    this.hints.clear();
    this.autoExpandPaths.clear();
    this.notify();
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  /**
   * Get the computed hint info for a specific path (file or directory).
   *
   * @param path - Absolute file or directory path.
   * @returns HintInfo if the path has a hint, undefined otherwise.
   */
  getHint(path: string): HintInfo | undefined {
    return this.hints.get(path);
  }

  /**
   * Get all current hints as a read-only map of path to HintInfo.
   */
  getAllHints(): ReadonlyMap<string, HintInfo> {
    return this.hints;
  }

  /**
   * Get the set of directory paths that should be auto-expanded in the
   * file tree to reveal hinted files.
   */
  getAutoExpandPaths(): ReadonlySet<string> {
    return this.autoExpandPaths;
  }

  // -------------------------------------------------------------------------
  // Internal: hint processing
  // -------------------------------------------------------------------------

  /**
   * Process a single explorer hint and populate the hints and autoExpandPaths
   * maps. Handles all three styles (subtle, obvious, unmissable).
   */
  private processHint(hint: ExplorerHint): void {
    const { path, style } = hint;

    switch (style) {
      case 'subtle':
        this.processSubtleHint(path);
        break;
      case 'obvious':
        this.processObviousHint(path, hint.directories);
        break;
      case 'unmissable':
        this.processUnmissableHint(path);
        break;
    }
  }

  /**
   * Subtle: Only the file itself gets a glow. No auto-expand.
   */
  private processSubtleHint(path: string): void {
    this.setHintIfHigher(path, { ...BASE_HINT_INFO, style: 'subtle' });
  }

  /**
   * Obvious: The file + backend-specified directories get glows.
   * Auto-expand only the top-level directory.
   */
  private processObviousHint(path: string, directories?: string[]): void {
    const hintInfo: HintInfo = { ...BASE_HINT_INFO, style: 'obvious' };

    this.setHintIfHigher(path, hintInfo);

    if (directories) {
      for (const dir of directories) {
        this.setHintIfHigher(dir, hintInfo);
      }
    }

    const topLevel = getTopLevelDir(path);
    if (topLevel) {
      this.autoExpandPaths.add(topLevel);
    }
  }

  /**
   * Unmissable: The file + ALL ancestor directories get glows with an
   * intensity gradient. Full path auto-expand.
   */
  private processUnmissableHint(path: string): void {
    // File itself: distance 0
    this.setHintIfHigher(path, getGradientEntry(0));

    // Ancestor directories: distance increases from parent to root
    const ancestors = getAncestorPaths(path);

    for (let i = 0; i < ancestors.length; i++) {
      // Distance from the file: ancestors are ordered shallowest-first,
      // so the deepest ancestor (closest to the file) is at the end.
      const distance = ancestors.length - i;
      const ancestorPath = ancestors[i]!;
      this.setHintIfHigher(ancestorPath, getGradientEntry(distance));

      // Auto-expand all ancestors
      this.autoExpandPaths.add(ancestorPath);
    }
  }

  /**
   * Set the hint for a path, but only if the new hint has a higher
   * intensity than any existing hint at that path. This implements
   * the "highest intensity wins" conflict resolution.
   */
  private setHintIfHigher(path: string, hintInfo: HintInfo): void {
    const existing = this.hints.get(path);
    if (!existing || hintInfo.intensity > existing.intensity) {
      this.hints.set(path, hintInfo);
    }
  }

  // -------------------------------------------------------------------------
  // Internal: notification
  // -------------------------------------------------------------------------

  /** Notify all subscribed listeners of a state change. */
  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[HintManagerService] Listener error:', message);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

/** Singleton hint manager service instance for the application. */
export const hintManager = new HintManagerService();

export { HintManagerService, getAncestorPaths };
