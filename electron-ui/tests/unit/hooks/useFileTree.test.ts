/**
 * Unit tests for the useFileTree hook and its pure tree-update helpers.
 *
 * Tests cover:
 * - parentPath utility
 * - addNode immutable tree insertion
 * - removeNode immutable tree removal
 * - Hook: initial state (null)
 * - Hook: fs:tree sets initial tree
 * - Hook: fs:tree_update add/remove/rename
 * - Hook: openFile sends file:open message
 * - Hook: graceful handling of missing node/newPath
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { TreeNode } from '@shared/types/entities';
import type { WebSocketMessage } from '@shared/types/websocket-messages';
import {
  parentPath,
  addNode,
  removeNode,
  useFileTree,
} from '../../../renderer/src/hooks/useFileTree';

// ---------------------------------------------------------------------------
// Mock useWebSocket (vi.mock calls are hoisted by Vitest)
// ---------------------------------------------------------------------------

type MessageHandler = (msg: WebSocketMessage) => void;

const mockSend = vi.fn<(type: string, payload: unknown) => Promise<WebSocketMessage | void>>();
const handlers = new Map<string, MessageHandler>();

vi.mock('../../../renderer/src/hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    send: mockSend,
    on: (type: string, handler: MessageHandler) => {
      handlers.set(type, handler);
      return () => {
        handlers.delete(type);
      };
    },
  }),
}));

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeTree(): TreeNode {
  return {
    name: 'project',
    path: '/project',
    type: 'directory',
    children: [
      {
        name: 'src',
        path: '/project/src',
        type: 'directory',
        children: [
          { name: 'index.ts', path: '/project/src/index.ts', type: 'file' },
          { name: 'utils.ts', path: '/project/src/utils.ts', type: 'file' },
        ],
      },
      { name: 'README.md', path: '/project/README.md', type: 'file' },
    ],
  };
}

function makeMessage(type: string, payload: unknown): WebSocketMessage {
  return {
    type,
    payload,
    timestamp: Date.now(),
  } as unknown as WebSocketMessage;
}

/** Simulate a WebSocket message arriving for a given type. */
function simulateMessage(type: string, payload: unknown): void {
  const handler = handlers.get(type);
  if (handler) {
    handler(makeMessage(type, payload));
  }
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  handlers.clear();
  mockSend.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// Pure helper tests
// ===========================================================================

describe('parentPath', () => {
  it('should return parent directory for a nested file path', () => {
    expect(parentPath('/project/src/index.ts')).toBe('/project/src');
  });

  it('should return root "/" for a top-level file', () => {
    expect(parentPath('/README.md')).toBe('/');
  });

  it('should return parent for a nested directory', () => {
    expect(parentPath('/project/src/hooks')).toBe('/project/src');
  });

  it('should return empty string for a relative path with no slash', () => {
    expect(parentPath('file.ts')).toBe('');
  });

  it('should return "/" for root path "/"', () => {
    expect(parentPath('/')).toBe('/');
  });
});

describe('addNode', () => {
  it('should add a child to the matching parent directory', () => {
    const tree = makeTree();
    const newNode: TreeNode = {
      name: 'helpers.ts',
      path: '/project/src/helpers.ts',
      type: 'file',
    };

    const result = addNode(tree, '/project/src', newNode);

    expect(result).not.toBe(tree); // immutable
    const srcDir = result.children?.find((c) => c.name === 'src');
    expect(srcDir?.children).toHaveLength(3);
    expect(srcDir?.children?.find((c) => c.name === 'helpers.ts')).toBeDefined();
  });

  it('should not mutate the original tree', () => {
    const tree = makeTree();
    const originalChildCount = tree.children![0]!.children!.length;

    addNode(tree, '/project/src', {
      name: 'new.ts',
      path: '/project/src/new.ts',
      type: 'file',
    });

    expect(tree.children![0]!.children!.length).toBe(originalChildCount);
  });

  it('should return the same tree reference if parent is not found', () => {
    const tree = makeTree();
    const newNode: TreeNode = {
      name: 'lost.ts',
      path: '/nowhere/lost.ts',
      type: 'file',
    };

    const result = addNode(tree, '/nowhere', newNode);
    expect(result).toBe(tree);
  });

  it('should not add a duplicate node (same path)', () => {
    const tree = makeTree();
    const duplicate: TreeNode = {
      name: 'index.ts',
      path: '/project/src/index.ts',
      type: 'file',
    };

    const result = addNode(tree, '/project/src', duplicate);
    const srcDir = result.children?.find((c) => c.name === 'src');
    expect(srcDir?.children).toHaveLength(2);
    expect(result).toBe(tree); // no change, same reference
  });

  it('should add a child to the root directory', () => {
    const tree = makeTree();
    const newNode: TreeNode = {
      name: '.gitignore',
      path: '/project/.gitignore',
      type: 'file',
    };

    const result = addNode(tree, '/project', newNode);
    expect(result.children).toHaveLength(3);
    expect(result.children?.find((c) => c.name === '.gitignore')).toBeDefined();
  });

  it('should add a directory node with its own children', () => {
    const tree = makeTree();
    const newDir: TreeNode = {
      name: 'hooks',
      path: '/project/src/hooks',
      type: 'directory',
      children: [
        { name: 'useFileTree.ts', path: '/project/src/hooks/useFileTree.ts', type: 'file' },
      ],
    };

    const result = addNode(tree, '/project/src', newDir);
    const srcDir = result.children?.find((c) => c.name === 'src');
    const hooksDir = srcDir?.children?.find((c) => c.name === 'hooks');
    expect(hooksDir).toBeDefined();
    expect(hooksDir?.type).toBe('directory');
    expect(hooksDir?.children).toHaveLength(1);
  });
});

describe('removeNode', () => {
  it('should remove a file from the tree', () => {
    const tree = makeTree();
    const result = removeNode(tree, '/project/src/utils.ts');

    expect(result).not.toBe(tree); // immutable
    const srcDir = result.children?.find((c) => c.name === 'src');
    expect(srcDir?.children).toHaveLength(1);
    expect(srcDir?.children?.find((c) => c.name === 'utils.ts')).toBeUndefined();
  });

  it('should not mutate the original tree', () => {
    const tree = makeTree();
    const originalChildCount = tree.children![0]!.children!.length;

    removeNode(tree, '/project/src/utils.ts');

    expect(tree.children![0]!.children!.length).toBe(originalChildCount);
  });

  it('should return the same tree reference if path is not found', () => {
    const tree = makeTree();
    const result = removeNode(tree, '/project/nonexistent.ts');
    expect(result).toBe(tree);
  });

  it('should not remove the root node itself', () => {
    const tree = makeTree();
    const result = removeNode(tree, '/project');
    expect(result).toBe(tree);
  });

  it('should remove a top-level child', () => {
    const tree = makeTree();
    const result = removeNode(tree, '/project/README.md');

    expect(result.children).toHaveLength(1);
    expect(result.children?.find((c) => c.name === 'README.md')).toBeUndefined();
  });

  it('should remove a directory and all its children', () => {
    const tree = makeTree();
    const result = removeNode(tree, '/project/src');

    expect(result.children).toHaveLength(1);
    expect(result.children?.find((c) => c.name === 'src')).toBeUndefined();
  });
});

// ===========================================================================
// Hook tests
// ===========================================================================

describe('useFileTree', () => {
  it('should return null tree initially', () => {
    const { result } = renderHook(() => useFileTree());
    expect(result.current.tree).toBeNull();
  });

  it('should set tree when fs:tree message is received', () => {
    const { result } = renderHook(() => useFileTree());
    const treeData = makeTree();

    act(() => {
      simulateMessage('fs:tree', { root: treeData });
    });

    expect(result.current.tree).toEqual(treeData);
  });

  it('should handle add action from fs:tree_update', () => {
    const { result } = renderHook(() => useFileTree());

    // Set initial tree
    act(() => {
      simulateMessage('fs:tree', { root: makeTree() });
    });

    // Add a new file
    const newFile: TreeNode = {
      name: 'config.ts',
      path: '/project/src/config.ts',
      type: 'file',
    };

    act(() => {
      simulateMessage('fs:tree_update', {
        action: 'add',
        path: '/project/src/config.ts',
        node: newFile,
      });
    });

    const srcDir = result.current.tree?.children?.find((c) => c.name === 'src');
    expect(srcDir?.children).toHaveLength(3);
    expect(srcDir?.children?.find((c) => c.name === 'config.ts')).toBeDefined();
  });

  it('should handle remove action from fs:tree_update', () => {
    const { result } = renderHook(() => useFileTree());

    act(() => {
      simulateMessage('fs:tree', { root: makeTree() });
    });

    act(() => {
      simulateMessage('fs:tree_update', {
        action: 'remove',
        path: '/project/src/utils.ts',
      });
    });

    const srcDir = result.current.tree?.children?.find((c) => c.name === 'src');
    expect(srcDir?.children).toHaveLength(1);
    expect(srcDir?.children?.find((c) => c.name === 'utils.ts')).toBeUndefined();
  });

  it('should handle rename action from fs:tree_update', () => {
    const { result } = renderHook(() => useFileTree());

    act(() => {
      simulateMessage('fs:tree', { root: makeTree() });
    });

    const renamedNode: TreeNode = {
      name: 'helpers.ts',
      path: '/project/src/helpers.ts',
      type: 'file',
    };

    act(() => {
      simulateMessage('fs:tree_update', {
        action: 'rename',
        path: '/project/src/utils.ts',
        newPath: '/project/src/helpers.ts',
        node: renamedNode,
      });
    });

    const srcDir = result.current.tree?.children?.find((c) => c.name === 'src');
    expect(srcDir?.children?.find((c) => c.name === 'utils.ts')).toBeUndefined();
    expect(srcDir?.children?.find((c) => c.name === 'helpers.ts')).toBeDefined();
    expect(srcDir?.children).toHaveLength(2);
  });

  it('should ignore add action when node is missing', () => {
    const { result } = renderHook(() => useFileTree());
    const initialTree = makeTree();

    act(() => {
      simulateMessage('fs:tree', { root: initialTree });
    });

    act(() => {
      simulateMessage('fs:tree_update', {
        action: 'add',
        path: '/project/src/missing.ts',
        // node is intentionally missing
      });
    });

    // Tree should remain unchanged
    expect(result.current.tree).toEqual(initialTree);
  });

  it('should ignore rename action when newPath is missing', () => {
    const { result } = renderHook(() => useFileTree());
    const initialTree = makeTree();

    act(() => {
      simulateMessage('fs:tree', { root: initialTree });
    });

    act(() => {
      simulateMessage('fs:tree_update', {
        action: 'rename',
        path: '/project/src/utils.ts',
        // newPath and node are intentionally missing
      });
    });

    expect(result.current.tree).toEqual(initialTree);
  });

  it('should not update tree if tree is null when fs:tree_update arrives', () => {
    const { result } = renderHook(() => useFileTree());

    // No fs:tree received yet, tree is null
    act(() => {
      simulateMessage('fs:tree_update', {
        action: 'add',
        path: '/project/src/new.ts',
        node: { name: 'new.ts', path: '/project/src/new.ts', type: 'file' },
      });
    });

    expect(result.current.tree).toBeNull();
  });

  it('should send file:open message when openFile is called', () => {
    const { result } = renderHook(() => useFileTree());

    act(() => {
      result.current.openFile('/project/src/index.ts');
    });

    expect(mockSend).toHaveBeenCalledWith('file:open', {
      path: '/project/src/index.ts',
    });
  });

  it('should provide a stable openFile reference across re-renders', () => {
    const { result, rerender } = renderHook(() => useFileTree());
    const firstRef = result.current.openFile;

    rerender();
    expect(result.current.openFile).toBe(firstRef);
  });

  it('should unsubscribe from WebSocket on unmount', () => {
    const { unmount } = renderHook(() => useFileTree());

    // Both handlers should be registered
    expect(handlers.has('fs:tree')).toBe(true);
    expect(handlers.has('fs:tree_update')).toBe(true);

    unmount();

    // Handlers should be cleaned up
    expect(handlers.has('fs:tree')).toBe(false);
    expect(handlers.has('fs:tree_update')).toBe(false);
  });

  it('should handle multiple sequential updates correctly', () => {
    const { result } = renderHook(() => useFileTree());

    act(() => {
      simulateMessage('fs:tree', { root: makeTree() });
    });

    // Add a file, then remove a different one
    act(() => {
      simulateMessage('fs:tree_update', {
        action: 'add',
        path: '/project/src/config.ts',
        node: { name: 'config.ts', path: '/project/src/config.ts', type: 'file' },
      });
    });

    act(() => {
      simulateMessage('fs:tree_update', {
        action: 'remove',
        path: '/project/src/index.ts',
      });
    });

    const srcDir = result.current.tree?.children?.find((c) => c.name === 'src');
    expect(srcDir?.children).toHaveLength(2); // utils.ts + config.ts
    expect(srcDir?.children?.find((c) => c.name === 'config.ts')).toBeDefined();
    expect(srcDir?.children?.find((c) => c.name === 'index.ts')).toBeUndefined();
    expect(srcDir?.children?.find((c) => c.name === 'utils.ts')).toBeDefined();
  });
});
