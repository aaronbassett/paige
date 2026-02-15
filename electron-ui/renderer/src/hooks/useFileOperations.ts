/**
 * useFileOperations -- Wires WebSocket file flows to the editor state.
 *
 * This hook is the glue between the WebSocket transport layer and the
 * in-memory editor tab/content state. It handles:
 *
 *  1. **Open**: `file:open` -> backend -> `buffer:content` -> open tab
 *  2. **Save**: `file:save` -> backend -> `save:ack` -> clear dirty flag
 *  3. **Debounced updates**: Sends `buffer:update` on content changes
 *     (300ms trailing debounce, 5s max-wait)
 *  4. **Keyboard shortcuts**: Cmd+S (save), Cmd+W (close)
 *  5. **Deleted file detection**: Marks tabs when `fs:tree_update` remove
 *     arrives for an open file's path
 *
 * The hook subscribes to the editorState service for content change
 * notifications and to the WebSocket for backend responses.
 */

import { useEffect, useCallback, useRef } from 'react';
import { getLogger } from '../logger';
import { useWebSocket } from './useWebSocket';
import { editorState } from '../services/editor-state';

const logger = getLogger(['paige', 'renderer', 'file-ops']);
import {
  debounce,
  DEBOUNCE_BUFFER_UPDATE,
  DEBOUNCE_BUFFER_MAX_WAIT,
  type DebouncedFunction,
} from '../services/debouncer';
import type {
  WebSocketMessage,
  BufferContentMessage,
  SaveAckMessage,
  FsTreeUpdateMessage,
} from '@shared/types/websocket-messages';

// ---------------------------------------------------------------------------
// Language -> icon mapping
// ---------------------------------------------------------------------------

/**
 * Map a Monaco language ID to a short icon string used by the tab strip.
 * Falls back to 'file' for unrecognized languages.
 */
function getFileIcon(language: string): string {
  const iconMap: Record<string, string> = {
    typescript: 'ts',
    javascript: 'js',
    typescriptreact: 'tsx',
    javascriptreact: 'jsx',
    python: 'py',
    rust: 'rs',
    go: 'go',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    markdown: 'md',
    yaml: 'yml',
    xml: 'xml',
    shell: 'sh',
    dockerfile: 'docker',
    sql: 'sql',
  };
  return iconMap[language] ?? 'file';
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseFileOperationsReturn {
  /** Open a file by path. If already open, switches to its tab. */
  openFile: (path: string) => void;
  /** Save the currently active file to the backend. */
  saveActiveFile: () => void;
  /** Close the currently active tab (prompts if dirty). */
  closeActiveTab: () => void;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useFileOperations(): UseFileOperationsReturn {
  const { send, on } = useWebSocket();

  /**
   * Ref to hold the debounced buffer:update sender so we can flush/cancel
   * it from save and unmount without re-creating the debounced function
   * on every render.
   */
  const debouncedUpdateRef = useRef<DebouncedFunction<[string, string]> | null>(null);

  // -------------------------------------------------------------------------
  // Debounced buffer:update sender
  // -------------------------------------------------------------------------

  useEffect(() => {
    const sendBufferUpdate = (path: string, content: string) => {
      const tab = editorState.getTab(path);
      const cursor = tab?.cursorPosition ?? { line: 1, column: 1 };
      void send('buffer:update', {
        path,
        content,
        cursorPosition: cursor,
      });
    };

    const debouncedSend = debounce(
      sendBufferUpdate,
      DEBOUNCE_BUFFER_UPDATE,
      DEBOUNCE_BUFFER_MAX_WAIT
    );

    debouncedUpdateRef.current = debouncedSend;

    // Subscribe to editor state changes and send debounced updates when
    // content changes (dirty flag set).
    let previousDirtyPaths = new Set<string>();

    const unsubscribe = editorState.subscribe(() => {
      const tabs = editorState.getTabs();
      const currentDirtyPaths = new Set<string>();

      for (const tab of tabs) {
        if (tab.isDirty) {
          currentDirtyPaths.add(tab.path);
          // Only fire debounced update for newly-dirty paths
          if (!previousDirtyPaths.has(tab.path)) {
            const content = editorState.getContent(tab.path);
            if (content !== undefined) {
              debouncedSend(tab.path, content);
            }
          }
        }
      }

      previousDirtyPaths = currentDirtyPaths;
    });

    return () => {
      unsubscribe();
      debouncedSend.cancel();
    };
  }, [send]);

  // -------------------------------------------------------------------------
  // WebSocket handlers: buffer:content, save:ack, fs:tree_update
  // -------------------------------------------------------------------------

  useEffect(() => {
    const unsubContent = on('buffer:content', (msg: WebSocketMessage) => {
      const { payload } = msg as BufferContentMessage;
      const { path, content, language } = payload;

      editorState.openTab({
        path,
        language,
        icon: getFileIcon(language),
      });
      editorState.setContent(path, content);
    });

    const unsubSaveAck = on('save:ack', (msg: WebSocketMessage) => {
      const { payload } = msg as SaveAckMessage;
      if (payload.success) {
        editorState.clearDirty(payload.path);
      } else {
        logger.error`Save failed: ${payload.path} — ${payload.error}`;
      }
    });

    const unsubTreeUpdate = on('fs:tree_update', (msg: WebSocketMessage) => {
      const { payload } = msg as FsTreeUpdateMessage;
      if (payload.action === 'remove') {
        // If the removed file has an open tab, mark it as deleted
        // by setting a special content marker. The CodeEditor checks for this.
        const tab = editorState.getTab(payload.path);
        if (tab) {
          editorState.setContent(payload.path, '__PAIGE_FILE_DELETED__');
          // Notify subscribers so the editor can react
          editorState.setDirty(payload.path);
          editorState.clearDirty(payload.path);
        }
      }
    });

    return () => {
      unsubContent();
      unsubSaveAck();
      unsubTreeUpdate();
    };
  }, [on]);

  // -------------------------------------------------------------------------
  // openFile
  // -------------------------------------------------------------------------

  const openFile = useCallback(
    (path: string) => {
      // If the tab is already open, just switch to it
      const existingTab = editorState.getTab(path);
      if (existingTab) {
        editorState.setActiveTab(path);
        return;
      }

      // Otherwise request file content from backend
      void send('file:open', { path });
    },
    [send]
  );

  // -------------------------------------------------------------------------
  // saveActiveFile
  // -------------------------------------------------------------------------

  const saveActiveFile = useCallback(() => {
    const activeTab = editorState.getActiveTab();
    if (!activeTab) {
      return;
    }

    // Flush any pending debounced buffer:update before saving
    debouncedUpdateRef.current?.flush();

    const content = editorState.getContent(activeTab.path) ?? '';
    void send('file:save', { path: activeTab.path, content });
  }, [send]);

  // -------------------------------------------------------------------------
  // closeActiveTab
  // -------------------------------------------------------------------------

  const closeActiveTab = useCallback(() => {
    const activeTab = editorState.getActiveTab();
    if (!activeTab) {
      return;
    }

    if (activeTab.isDirty) {
      const filename = activeTab.path.split('/').pop() ?? activeTab.path;
      const confirmed = window.confirm(`Discard unsaved changes to ${filename}?`);
      if (!confirmed) {
        return;
      }
    }

    // Notify backend that the tab is closed
    void send('file:close', { path: activeTab.path });
    editorState.closeTab(activeTab.path);
  }, [send]);

  // -------------------------------------------------------------------------
  // Keyboard shortcuts: Cmd+S (save), Cmd+W (close)
  // -------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === 's') {
        e.preventDefault();
        saveActiveFile();
      } else if (isMod && e.key === 'w') {
        e.preventDefault();
        closeActiveTab();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [saveActiveFile, closeActiveTab]);

  return { openFile, saveActiveFile, closeActiveTab };
}
