/**
 * useFileTree -- Manages file tree state from WebSocket messages.
 *
 * Subscribes to `fs:tree` for the initial file tree and `fs:tree_update`
 * for incremental changes (add, remove, rename). Provides a stable
 * `openFile` callback that sends `file:open` to the backend.
 *
 * All tree mutations are immutable -- helper functions return new tree
 * objects without mutating the previous state.
 */

import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import type { TreeNode } from '@shared/types/entities';
import type {
  WebSocketMessage,
  FsTreeMessage,
  FsTreeUpdateMessage,
} from '@shared/types/websocket-messages';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseFileTreeReturn {
  /** The file tree data, null while loading. */
  tree: TreeNode | null;
  /** Open a file by sending file:open WebSocket message. */
  openFile: (path: string) => void;
}

// ---------------------------------------------------------------------------
// Pure tree-update helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Derive the parent directory path from a full file/directory path.
 * For example, `/src/hooks/useFileTree.ts` returns `/src/hooks`.
 * Returns an empty string if there is no parent (root-level node).
 */
export function parentPath(filePath: string): string {
  const lastSlash = filePath.lastIndexOf('/');
  if (lastSlash <= 0) return filePath.charAt(0) === '/' ? '/' : '';
  return filePath.substring(0, lastSlash);
}

/**
 * Immutably add a node to the tree under the directory matching `targetParentPath`.
 * If the parent directory is not found, the original tree is returned unchanged.
 */
export function addNode(tree: TreeNode, targetParentPath: string, node: TreeNode): TreeNode {
  // If this node IS the target parent directory, add the child here
  if (tree.path === targetParentPath && tree.type === 'directory') {
    const existingChildren = tree.children ?? [];
    // Avoid adding a duplicate (same path)
    if (existingChildren.some((child) => child.path === node.path)) {
      return tree;
    }
    return {
      ...tree,
      children: [...existingChildren, node],
    };
  }

  // Recurse into children if this is a directory
  if (tree.type === 'directory' && tree.children) {
    const updatedChildren = tree.children.map((child) =>
      addNode(child, targetParentPath, node),
    );
    // Only create a new object if something actually changed
    if (updatedChildren.some((child, i) => child !== tree.children![i])) {
      return { ...tree, children: updatedChildren };
    }
  }

  return tree;
}

/**
 * Immutably remove the node at `targetPath` from the tree.
 * Returns the updated tree, or the original tree if the path was not found.
 */
export function removeNode(tree: TreeNode, targetPath: string): TreeNode {
  // Cannot remove the root itself
  if (tree.path === targetPath) {
    return tree;
  }

  if (tree.type === 'directory' && tree.children) {
    const filtered = tree.children.filter((child) => child.path !== targetPath);
    const recursed = filtered.map((child) => removeNode(child, targetPath));

    // Only create a new object if something changed
    const childrenChanged =
      filtered.length !== tree.children.length ||
      recursed.some((child, i) => child !== filtered[i]);

    if (childrenChanged) {
      return { ...tree, children: recursed };
    }
  }

  return tree;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFileTree(): UseFileTreeReturn {
  const { send, on } = useWebSocket();
  const [tree, setTree] = useState<TreeNode | null>(null);

  // Subscribe to fs:tree (initial tree)
  useEffect(() => {
    const unsub = on('fs:tree', (msg: WebSocketMessage) => {
      const { payload } = msg as FsTreeMessage;
      setTree(payload.root);
    });
    return unsub;
  }, [on]);

  // Subscribe to fs:tree_update (incremental changes)
  useEffect(() => {
    const unsub = on('fs:tree_update', (msg: WebSocketMessage) => {
      const { payload } = msg as FsTreeUpdateMessage;

      setTree((prev) => {
        if (!prev) return prev;

        switch (payload.action) {
          case 'add': {
            if (!payload.node) return prev;
            const parent = parentPath(payload.path);
            return addNode(prev, parent, payload.node);
          }
          case 'remove': {
            return removeNode(prev, payload.path);
          }
          case 'rename': {
            if (!payload.newPath || !payload.node) return prev;
            const removed = removeNode(prev, payload.path);
            const newParent = parentPath(payload.newPath);
            return addNode(removed, newParent, payload.node);
          }
          default:
            return prev;
        }
      });
    });
    return unsub;
  }, [on]);

  // Open a file by requesting its content from the backend
  const openFile = useCallback(
    (path: string) => {
      void send('file:open', { path });
    },
    [send],
  );

  return { tree, openFile };
}
