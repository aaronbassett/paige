/**
 * Editor state service for the Paige Electron UI.
 *
 * Singleton service that manages open editor tabs, active tab tracking,
 * dirty state, cursor positions, and tab content. React components subscribe
 * to state changes via the listener API and re-render when notified.
 *
 * This service is the single source of truth for all editor tab state.
 * Components (Editor, EditorTabs, StatusBar) read from here and dispatch
 * mutations through the public methods.
 */

import type { TabState, CursorPosition } from '@shared/types/entities';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal input required to open a new tab. isDirty always starts false. */
export interface OpenTabOptions {
  path: string;
  language: string;
  icon: string;
}

/** Listener callback invoked whenever editor state changes. */
export type EditorStateListener = () => void;

// ---------------------------------------------------------------------------
// EditorStateService
// ---------------------------------------------------------------------------

/**
 * Manages the full lifecycle of editor tabs: open, close, switch, dirty
 * tracking, cursor positions, and content storage.
 *
 * Uses a listener pattern (subscribe/unsubscribe) so React components can
 * trigger re-renders on state changes without tight coupling.
 *
 * @example
 * ```ts
 * import { editorState } from './services/editor-state';
 *
 * // Open a file
 * editorState.openTab({ path: '/src/index.ts', language: 'typescript', icon: 'ts' });
 *
 * // Subscribe to changes
 * const unsubscribe = editorState.subscribe(() => {
 *   console.log('Tabs changed:', editorState.getTabs());
 * });
 *
 * // Clean up
 * unsubscribe();
 * ```
 */
class EditorStateService {
  /** Ordered list of open tabs. Insertion order is preserved. */
  private tabs: TabState[] = [];

  /** Path of the currently active (focused) tab, or undefined if none. */
  private activeTabPath: string | undefined = undefined;

  /**
   * Content cache keyed by file path. Stores the latest editor content
   * for each open tab so dirty checking and file operations can access
   * it without round-tripping to the backend.
   */
  private contentMap = new Map<string, string>();

  /** Set of subscribed listeners notified on every state mutation. */
  private listeners = new Set<EditorStateListener>();

  // -------------------------------------------------------------------------
  // Subscription
  // -------------------------------------------------------------------------

  /**
   * Subscribe to state changes. The listener is called (with no arguments)
   * whenever any tab state mutates. Returns an unsubscribe function.
   *
   * @param listener - Callback invoked on state change.
   * @returns A function that removes the listener when called.
   */
  subscribe(listener: EditorStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // -------------------------------------------------------------------------
  // Tab open / close / switch
  // -------------------------------------------------------------------------

  /**
   * Open a tab for the given file. If the file is already open, the existing
   * tab is activated without creating a duplicate. If it is new, a tab is
   * appended to the end of the tab list and made active.
   *
   * @param options - Path, language, and icon for the tab.
   */
  openTab(options: OpenTabOptions): void {
    const { path, language, icon } = options;

    const existing = this.tabs.find((t) => t.path === path);
    if (existing) {
      // Already open -- just switch to it
      this.activeTabPath = path;
      this.notify();
      return;
    }

    const tab: TabState = {
      path,
      language,
      isDirty: false,
      icon,
    };

    this.tabs = [...this.tabs, tab];
    this.activeTabPath = path;
    this.notify();
  }

  /**
   * Close the tab at the given path. If the closed tab was the active tab,
   * the adjacent tab is activated (prefer the tab to the right; fall back to
   * the tab to the left). Closing the last remaining tab sets activeTabPath
   * to undefined.
   *
   * Also removes the file's cached content from the content map.
   *
   * @param path - Absolute file path of the tab to close.
   */
  closeTab(path: string): void {
    const index = this.tabs.findIndex((t) => t.path === path);
    if (index === -1) {
      return; // Tab not found -- nothing to do
    }

    const wasTabs = this.tabs;
    this.tabs = wasTabs.filter((t) => t.path !== path);
    this.contentMap.delete(path);

    // If we closed the active tab, pick a new one
    if (this.activeTabPath === path) {
      if (this.tabs.length === 0) {
        this.activeTabPath = undefined;
      } else {
        // Prefer the tab that was to the right (same index position in the
        // shortened array). If that index is out of bounds, take the last tab.
        const nextIndex = Math.min(index, this.tabs.length - 1);
        const nextTab = this.tabs[nextIndex];
        this.activeTabPath = nextTab?.path;
      }
    }

    this.notify();
  }

  /**
   * Switch the active tab to the given path. If the path does not correspond
   * to an open tab, this is a no-op (the tab must be opened first).
   *
   * @param path - Absolute file path of the tab to activate.
   */
  setActiveTab(path: string): void {
    const exists = this.tabs.some((t) => t.path === path);
    if (!exists) {
      return; // Can't activate a tab that isn't open
    }

    if (this.activeTabPath === path) {
      return; // Already active -- skip notification
    }

    this.activeTabPath = path;
    this.notify();
  }

  // -------------------------------------------------------------------------
  // Dirty state
  // -------------------------------------------------------------------------

  /**
   * Mark a tab as dirty (has unsaved changes). Optionally update the cached
   * content at the same time.
   *
   * @param path - Absolute file path of the tab to mark dirty.
   * @param content - Optional new content to cache for this file.
   */
  setDirty(path: string, content?: string): void {
    const tab = this.tabs.find((t) => t.path === path);
    if (!tab) {
      return;
    }

    if (content !== undefined) {
      this.contentMap.set(path, content);
    }

    if (!tab.isDirty) {
      this.tabs = this.tabs.map((t) => (t.path === path ? { ...t, isDirty: true } : t));
      this.notify();
    }
  }

  /**
   * Clear the dirty flag for a tab, typically after a successful save
   * acknowledgement from the backend. If content is provided, the cached
   * content is updated to reflect the saved state.
   *
   * @param path - Absolute file path of the tab to mark clean.
   * @param content - Optional saved content to cache.
   */
  clearDirty(path: string, content?: string): void {
    const tab = this.tabs.find((t) => t.path === path);
    if (!tab) {
      return;
    }

    if (content !== undefined) {
      this.contentMap.set(path, content);
    }

    if (tab.isDirty) {
      this.tabs = this.tabs.map((t) => (t.path === path ? { ...t, isDirty: false } : t));
      this.notify();
    }
  }

  // -------------------------------------------------------------------------
  // Cursor position
  // -------------------------------------------------------------------------

  /**
   * Update the stored cursor position for a tab. Only notifies listeners
   * if the position actually changed (avoids re-renders on identical updates).
   *
   * @param path - Absolute file path of the tab.
   * @param position - New cursor position (1-indexed line and column).
   */
  updateCursor(path: string, position: CursorPosition): void {
    const tab = this.tabs.find((t) => t.path === path);
    if (!tab) {
      return;
    }

    // Skip notification if position hasn't changed
    if (
      tab.cursorPosition?.line === position.line &&
      tab.cursorPosition?.column === position.column
    ) {
      return;
    }

    this.tabs = this.tabs.map((t) =>
      t.path === path ? { ...t, cursorPosition: { ...position } } : t,
    );
    this.notify();
  }

  // -------------------------------------------------------------------------
  // Content management
  // -------------------------------------------------------------------------

  /**
   * Set the cached content for a file path. Does NOT mark the tab dirty;
   * use {@link setDirty} if the content represents an unsaved edit.
   *
   * This is used when loading initial file content from the backend.
   *
   * @param path - Absolute file path.
   * @param content - File content string.
   */
  setContent(path: string, content: string): void {
    this.contentMap.set(path, content);
  }

  /**
   * Get the cached content for a file path, or undefined if not cached.
   *
   * @param path - Absolute file path.
   * @returns The cached content, or undefined.
   */
  getContent(path: string): string | undefined {
    return this.contentMap.get(path);
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  /**
   * Get the full ordered list of open tabs. Returns a shallow copy
   * so callers cannot mutate the internal array.
   */
  getTabs(): ReadonlyArray<TabState> {
    return this.tabs;
  }

  /**
   * Get a single tab by its file path, or undefined if not open.
   *
   * @param path - Absolute file path to look up.
   */
  getTab(path: string): TabState | undefined {
    return this.tabs.find((t) => t.path === path);
  }

  /**
   * Get the full TabState for the currently active tab, or undefined
   * if no tab is active.
   */
  getActiveTab(): TabState | undefined {
    if (this.activeTabPath === undefined) {
      return undefined;
    }
    return this.tabs.find((t) => t.path === this.activeTabPath);
  }

  /**
   * Get the file path of the currently active tab, or undefined if no
   * tab is active.
   */
  getActiveTabPath(): string | undefined {
    return this.activeTabPath;
  }

  // -------------------------------------------------------------------------
  // Bulk operations
  // -------------------------------------------------------------------------

  /**
   * Close all open tabs and clear all cached content. Resets to the initial
   * empty state. Useful on session reset or when switching projects.
   */
  closeAllTabs(): void {
    if (this.tabs.length === 0 && this.activeTabPath === undefined) {
      return; // Already empty -- skip notification
    }

    this.tabs = [];
    this.activeTabPath = undefined;
    this.contentMap.clear();
    this.notify();
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
        console.error('[EditorStateService] Listener error:', message);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

/** Singleton editor state service instance for the application. */
export const editorState = new EditorStateService();

export { EditorStateService };
