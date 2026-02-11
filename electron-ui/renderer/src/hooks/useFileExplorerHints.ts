/**
 * React hook for managing file explorer hints in the Paige Electron UI.
 *
 * Subscribes to `explorer:hint_files` and `explorer:clear_hints` WebSocket
 * messages and delegates to the singleton hintManager service. React
 * components consume the returned hints map and autoExpandPaths set to
 * render glow decorations and auto-expand directories in the file tree.
 *
 * Usage:
 * ```tsx
 * function FileExplorer() {
 *   const { hints, autoExpandPaths } = useFileExplorerHints();
 *
 *   // hints is ReadonlyMap<string, HintInfo>
 *   // autoExpandPaths is ReadonlySet<string>
 * }
 * ```
 */

import { useState, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { hintManager, type HintInfo } from '../services/hint-manager';
import type { WebSocketMessage, ExplorerHintFilesMessage } from '@shared/types/websocket-messages';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseFileExplorerHintsReturn {
  /** Map of path to hint info for rendering in the FileTree. */
  hints: ReadonlyMap<string, HintInfo>;
  /** Set of directory paths that should be auto-expanded. */
  autoExpandPaths: ReadonlySet<string>;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useFileExplorerHints(): UseFileExplorerHintsReturn {
  const { on } = useWebSocket();

  // -------------------------------------------------------------------------
  // Subscribe to hintManager state changes for React re-renders
  // -------------------------------------------------------------------------

  const [hints, setHints] = useState<ReadonlyMap<string, HintInfo>>(
    () => hintManager.getAllHints(),
  );
  const [autoExpandPaths, setAutoExpandPaths] = useState<ReadonlySet<string>>(
    () => hintManager.getAutoExpandPaths(),
  );

  useEffect(() => {
    const unsubscribe = hintManager.subscribe(() => {
      // Create new Map/Set instances so React detects the state change.
      // hintManager.getAllHints() returns the same internal Map reference
      // after mutations, so passing it directly would cause React to skip
      // the re-render (Object.is equality check on the same reference).
      setHints(new Map(hintManager.getAllHints()));
      setAutoExpandPaths(new Set(hintManager.getAutoExpandPaths()));
    });
    return unsubscribe;
  }, []);

  // -------------------------------------------------------------------------
  // WebSocket handlers: explorer:hint_files, explorer:clear_hints
  // -------------------------------------------------------------------------

  useEffect(() => {
    const unsubHintFiles = on('explorer:hint_files', (msg: WebSocketMessage) => {
      const { payload } = msg as ExplorerHintFilesMessage;
      hintManager.applyHints(payload.hints);
    });

    const unsubClearHints = on('explorer:clear_hints', () => {
      hintManager.clearHints();
    });

    return () => {
      unsubHintFiles();
      unsubClearHints();
    };
  }, [on]);

  return { hints, autoExpandPaths };
}
