/**
 * Integration tests for the File Explorer workflow.
 *
 * Verifies the end-to-end flow: tree renders with loading skeleton,
 * populates from WebSocket fs:tree messages, file clicks send file:open,
 * directories expand/collapse, incremental tree updates (add/remove) work,
 * and hint glows apply and clear correctly.
 *
 * Mocks:
 *   - useWebSocket: captures `on` handlers so tests can simulate server messages
 *   - react-arborist: lightweight mock Tree that renders nodes without
 *     virtualization or DOM measurements (happy-dom has no layout engine)
 *   - framer-motion: passthrough divs (no animation runtime in tests)
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import type { WebSocketMessage } from '@shared/types/websocket-messages';
import type { TreeNode } from '@shared/types/entities';

// ---------------------------------------------------------------------------
// Hoisted state shared between vi.mock factories and test body
// ---------------------------------------------------------------------------

const { mockSend, mockOn, expandedIdsRef } = vi.hoisted(() => {
  return {
    mockSend: vi.fn(),
    mockOn: vi.fn(),
    /** Mutable ref so both the mock factory and test body can access/reset it. */
    expandedIdsRef: { current: new Set<string>() },
  };
});

// ---------------------------------------------------------------------------
// Mock framer-motion -- replace motion.div with plain div
// ---------------------------------------------------------------------------

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      animate: _animate,
      transition: _transition,
      ...rest
    }: React.HTMLAttributes<HTMLDivElement> & {
      animate?: unknown;
      transition?: unknown;
    }) => <div {...rest}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ---------------------------------------------------------------------------
// Mock react-arborist -- lightweight rendering without virtualization
// ---------------------------------------------------------------------------

vi.mock('react-arborist', async () => {
  const React = await import('react');

  interface MockArboristNode {
    id: string;
    name: string;
    path: string;
    type: 'file' | 'directory';
    children?: MockArboristNode[];
  }

  /**
   * Recursively render nodes, calling the children render function for each
   * node (mirroring react-arborist). Directories track open state via the
   * shared expandedIdsRef.
   */
  function renderNodes(
    nodes: MockArboristNode[],
    renderFn: (props: Record<string, unknown>) => React.ReactNode,
    setToggle: React.Dispatch<React.SetStateAction<number>>,
    depth: number = 0,
  ): React.ReactNode[] {
    const result: React.ReactNode[] = [];
    const ids = expandedIdsRef.current;

    for (const nodeData of nodes) {
      const isDir = nodeData.type === 'directory';
      const isOpen = ids.has(nodeData.id);

      const mockNode = {
        data: nodeData,
        isOpen,
        toggle: () => {
          if (ids.has(nodeData.id)) {
            ids.delete(nodeData.id);
          } else {
            ids.add(nodeData.id);
          }
          setToggle((c: number) => c + 1);
        },
        id: nodeData.id,
        isLeaf: !isDir,
      };

      result.push(
        renderFn({
          key: nodeData.id,
          node: mockNode,
          style: { paddingLeft: depth * 12 },
          dragHandle: null,
        }),
      );

      if (isDir && isOpen && nodeData.children) {
        result.push(
          ...renderNodes(nodeData.children, renderFn, setToggle, depth + 1),
        );
      }
    }

    return result;
  }

  /**
   * Mock Tree component. Uses forwardRef so the parent can pass a ref
   * (FileTree uses treeRef for auto-expand via .open()).
   */
  const MockTree = React.forwardRef(function MockTree(
    props: {
      data: MockArboristNode[];
      children: (props: Record<string, unknown>) => React.ReactNode;
      [key: string]: unknown;
    },
    ref: React.Ref<unknown>,
  ) {
    const { data, children: renderFn } = props;
    const [, setToggle] = React.useState(0);

    React.useImperativeHandle(ref, () => ({
      open: (id: string) => {
        expandedIdsRef.current.add(id);
        setToggle((c: number) => c + 1);
      },
      close: (id: string) => {
        expandedIdsRef.current.delete(id);
        setToggle((c: number) => c + 1);
      },
    }));

    return React.createElement(
      'div',
      { role: 'tree' },
      ...renderNodes(data, renderFn, setToggle),
    );
  });

  return { Tree: MockTree };
});

// ---------------------------------------------------------------------------
// Mock useWebSocket
// ---------------------------------------------------------------------------

vi.mock('../../renderer/src/hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    status: 'connected' as const,
    reconnectAttempt: 0,
    send: mockSend,
    on: mockOn,
  }),
}));

// ---------------------------------------------------------------------------
// Imports AFTER mocks
// ---------------------------------------------------------------------------

import { FileTree } from '../../renderer/src/components/FileExplorer/FileTree';
import { useFileTree } from '../../renderer/src/hooks/useFileTree';
import { useFileExplorerHints } from '../../renderer/src/hooks/useFileExplorerHints';
import { hintManager } from '../../renderer/src/services/hint-manager';
import type { HintInfo } from '../../renderer/src/services/hint-manager';

// ---------------------------------------------------------------------------
// Test wrapper component
// ---------------------------------------------------------------------------

/**
 * Minimal component that wires useFileTree and useFileExplorerHints to FileTree.
 * Avoids importing the full IDE view and its many unrelated dependencies.
 */
function TestFileExplorer() {
  const { tree, openFile } = useFileTree();
  const { hints, autoExpandPaths } = useFileExplorerHints();

  // useFileExplorerHints returns ReadonlyMap; FileTree expects Map
  const hintsMap = hints instanceof Map
    ? (hints as Map<string, HintInfo>)
    : new Map(hints);

  return (
    <div style={{ width: 220, height: 600 }}>
      <FileTree
        tree={tree}
        hints={hintsMap}
        onFileClick={openFile}
        autoExpandPaths={autoExpandPaths}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Handler capture helper
// ---------------------------------------------------------------------------

/**
 * Captures the WebSocket message handlers registered by the hooks. After
 * rendering, call `simulateMessage` to push data into the component as if
 * it arrived from the backend.
 */
function setupHandlerCapture(): {
  handlers: Record<string, (msg: WebSocketMessage) => void>;
  simulateMessage: (type: string, payload: unknown) => void;
} {
  const handlers: Record<string, (msg: WebSocketMessage) => void> = {};

  mockOn.mockImplementation((type: string, handler: (msg: WebSocketMessage) => void) => {
    handlers[type] = handler;
    return vi.fn(); // unsubscribe function
  });

  const simulateMessage = (type: string, payload: unknown) => {
    act(() => {
      handlers[type]?.({
        type,
        payload,
        timestamp: Date.now(),
      } as WebSocketMessage);
    });
  };

  return { handlers, simulateMessage };
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function makeMockTree(): { root: TreeNode } {
  return {
    root: {
      name: 'project',
      path: '/project',
      type: 'directory' as const,
      children: [
        {
          name: 'src',
          path: '/project/src',
          type: 'directory' as const,
          children: [
            { name: 'index.ts', path: '/project/src/index.ts', type: 'file' as const },
            { name: 'App.tsx', path: '/project/src/App.tsx', type: 'file' as const },
          ],
        },
        { name: 'package.json', path: '/project/package.json', type: 'file' as const },
        { name: 'README.md', path: '/project/README.md', type: 'file' as const },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('File Explorer workflow integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hintManager.clearHints();
    expandedIdsRef.current = new Set();
  });

  // -------------------------------------------------------------------------
  // 1. Loading state
  // -------------------------------------------------------------------------

  it('renders loading skeleton when no fs:tree message has been received', () => {
    setupHandlerCapture();
    render(<TestFileExplorer />);

    // The EXPLORER header should be visible
    expect(screen.getByText('EXPLORER')).toBeInTheDocument();

    // The loading skeleton should be present (has role="status")
    const skeleton = screen.getByRole('status', { name: 'Loading file tree' });
    expect(skeleton).toBeInTheDocument();

    // No tree items should exist yet
    expect(screen.queryByRole('treeitem')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 2. Tree renders from fs:tree message
  // -------------------------------------------------------------------------

  it('renders file tree when fs:tree message arrives', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<TestFileExplorer />);

    // Send the initial tree
    simulateMessage('fs:tree', makeMockTree());

    // Top-level files should be visible (root children are rendered flat)
    expect(screen.getByText('package.json')).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();

    // The "src" directory should be visible
    expect(screen.getByText('src')).toBeInTheDocument();

    // The EXPLORER header should still be present
    expect(screen.getByText('EXPLORER')).toBeInTheDocument();

    // Loading skeleton should be gone
    expect(screen.queryByRole('status', { name: 'Loading file tree' })).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 3. File click sends file:open
  // -------------------------------------------------------------------------

  it('sends file:open when a file is clicked', async () => {
    const { simulateMessage } = setupHandlerCapture();
    const user = userEvent.setup();
    render(<TestFileExplorer />);

    // Populate the tree
    simulateMessage('fs:tree', makeMockTree());

    // Click package.json
    await user.click(screen.getByText('package.json'));

    expect(mockSend).toHaveBeenCalledWith('file:open', { path: '/project/package.json' });
  });

  // -------------------------------------------------------------------------
  // 4. Directory click expands and collapses
  // -------------------------------------------------------------------------

  it('expands a directory on click, revealing children, and collapses on second click', async () => {
    const { simulateMessage } = setupHandlerCapture();
    const user = userEvent.setup();
    render(<TestFileExplorer />);

    // Populate the tree
    simulateMessage('fs:tree', makeMockTree());

    // Initially, "src" directory children should NOT be visible (collapsed)
    expect(screen.queryByText('index.ts')).not.toBeInTheDocument();
    expect(screen.queryByText('App.tsx')).not.toBeInTheDocument();

    // Click "src" to expand
    await user.click(screen.getByText('src'));

    // Children should now be visible
    expect(screen.getByText('index.ts')).toBeInTheDocument();
    expect(screen.getByText('App.tsx')).toBeInTheDocument();

    // Click "src" again to collapse
    await user.click(screen.getByText('src'));

    // Children should be hidden again
    expect(screen.queryByText('index.ts')).not.toBeInTheDocument();
    expect(screen.queryByText('App.tsx')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 5. Tree update: add file
  // -------------------------------------------------------------------------

  it('adds a new file to the tree when fs:tree_update add message arrives', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<TestFileExplorer />);

    // Populate the initial tree
    simulateMessage('fs:tree', makeMockTree());

    // Verify the file does not exist yet
    expect(screen.queryByText('new-file.ts')).not.toBeInTheDocument();

    // Send an incremental add update
    simulateMessage('fs:tree_update', {
      action: 'add',
      path: '/project/new-file.ts',
      node: { name: 'new-file.ts', path: '/project/new-file.ts', type: 'file' },
    });

    // The new file should appear in the tree
    expect(screen.getByText('new-file.ts')).toBeInTheDocument();

    // Existing files should still be there
    expect(screen.getByText('package.json')).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 6. Tree update: remove file
  // -------------------------------------------------------------------------

  it('removes a file from the tree when fs:tree_update remove message arrives', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<TestFileExplorer />);

    // Populate the initial tree
    simulateMessage('fs:tree', makeMockTree());

    // Verify README.md exists
    expect(screen.getByText('README.md')).toBeInTheDocument();

    // Send an incremental remove update
    simulateMessage('fs:tree_update', {
      action: 'remove',
      path: '/project/README.md',
    });

    // README.md should be gone
    expect(screen.queryByText('README.md')).not.toBeInTheDocument();

    // Other files should remain
    expect(screen.getByText('package.json')).toBeInTheDocument();
    expect(screen.getByText('src')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 7. Hints apply and clear
  // -------------------------------------------------------------------------

  it('applies hint glows from explorer:hint_files and clears them on explorer:clear_hints', () => {
    const { simulateMessage } = setupHandlerCapture();
    render(<TestFileExplorer />);

    // Populate the tree
    simulateMessage('fs:tree', makeMockTree());

    // Verify no hints are applied yet (no inset box-shadow glow on items)
    const packageJsonNode = screen.getByText('package.json').closest('[role="treeitem"]');
    expect(packageJsonNode).not.toBeNull();
    expect(packageJsonNode!.getAttribute('style')).not.toContain('inset');

    // Send explorer:hint_files with a hint on package.json
    simulateMessage('explorer:hint_files', {
      hints: [
        { path: '/project/package.json', style: 'obvious', directories: ['/project'] },
      ],
    });

    // The hinted file node should now have an inset box-shadow glow
    const hintedNode = screen.getByText('package.json').closest('[role="treeitem"]');
    expect(hintedNode).not.toBeNull();
    const hintedStyle = hintedNode!.getAttribute('style') ?? '';
    expect(hintedStyle).toContain('inset');

    // Now clear all hints
    simulateMessage('explorer:clear_hints', {});

    // The glow should be removed
    const clearedNode = screen.getByText('package.json').closest('[role="treeitem"]');
    expect(clearedNode).not.toBeNull();
    const clearedStyle = clearedNode!.getAttribute('style') ?? '';
    expect(clearedStyle).not.toContain('inset');
  });
});
