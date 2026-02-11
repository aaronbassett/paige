/**
 * FileTree -- Virtualized file explorer for the Paige IDE sidebar.
 *
 * Uses react-arborist for efficient tree rendering with virtualization.
 * Displays project files and directories with:
 *   - Expand/collapse arrows for directories
 *   - File-type icons based on extension (text-based, no external SVGs)
 *   - Active file highlighting with terracotta accent
 *   - Hint glow styling for coached files/directories
 *   - Tooltip with full path on hover
 *   - Ellipsis truncation for long file names
 *
 * The component receives pre-transformed data via props and does NOT
 * subscribe to WebSocket directly. The parent (IDE.tsx) handles data
 * fetching and passes the tree down.
 *
 * States:
 *   - null tree: loading skeleton
 *   - tree with no children: "No files in project" message
 *   - tree with children: full file explorer
 */

import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { Tree } from 'react-arborist';
import type { NodeRendererProps } from 'react-arborist';
import type { TreeNode, ExplorerHintStyle } from '@shared/types/entities';
import type { HintInfo } from '../../services/hint-manager';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FileTreeProps {
  /** File tree data from the fs:tree WebSocket message. Null while loading. */
  tree: TreeNode | null;
  /** Map of file/directory paths to their hint styling info. */
  hints: Map<string, HintInfo>;
  /** Callback when a file is clicked (opens it in the editor). */
  onFileClick: (path: string) => void;
  /** Path of the currently active file in the editor. */
  activeFilePath?: string;
  /** Directory paths that should be auto-expanded (from hint manager). */
  autoExpandPaths?: ReadonlySet<string>;
}

// ---------------------------------------------------------------------------
// react-arborist data shape
// ---------------------------------------------------------------------------

/** Shape expected by react-arborist: id + name + children (optional). */
interface ArboristNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: ArboristNode[];
}

// ---------------------------------------------------------------------------
// Tree data transformation
// ---------------------------------------------------------------------------

/**
 * Recursively convert a TreeNode into the shape react-arborist expects.
 * Uses the file path as a unique id for each node.
 */
function toArboristData(node: TreeNode): ArboristNode {
  return {
    id: node.path,
    name: node.name,
    path: node.path,
    type: node.type,
    children:
      node.type === 'directory' && node.children
        ? node.children.map(toArboristData)
        : undefined,
  };
}

// ---------------------------------------------------------------------------
// File icon mapping
// ---------------------------------------------------------------------------

/**
 * Extension-to-icon mapping using simple Unicode/text glyphs.
 *
 * vscode-icons-js ships filename-to-SVG-name mappings but not the actual SVG
 * files. Rather than pulling in a CDN dependency or bundling hundreds of SVGs,
 * we use lightweight text-based icons that match the warm Paige aesthetic.
 */
const EXTENSION_ICONS: Record<string, string> = {
  // TypeScript / JavaScript
  ts: 'TS',
  tsx: 'TX',
  js: 'JS',
  jsx: 'JX',
  mjs: 'MJ',
  cjs: 'CJ',
  mts: 'MT',

  // Web
  html: '\u{1F310}',
  css: '#',
  scss: '#',
  less: '#',
  svg: '\u{25CB}',

  // Data / Config
  json: '{}',
  yaml: '\u{2261}',
  yml: '\u{2261}',
  toml: '\u{2261}',
  xml: '<>',
  csv: '\u{2637}',

  // Docs
  md: 'M\u{2193}',
  mdx: 'MX',
  txt: '\u{2630}',
  rst: '\u{2630}',

  // Images
  png: '\u{1F5BC}',
  jpg: '\u{1F5BC}',
  jpeg: '\u{1F5BC}',
  gif: '\u{1F5BC}',
  webp: '\u{1F5BC}',
  ico: '\u{1F5BC}',

  // Build / Config
  lock: '\u{1F512}',
  env: '\u{26A0}',
  gitignore: 'G',
  dockerignore: 'D',
  editorconfig: 'E',
  prettierrc: 'P',
  eslintrc: 'L',

  // Shell
  sh: '$',
  bash: '$',
  zsh: '$',

  // Python
  py: 'PY',
  pyi: 'PI',

  // Rust
  rs: 'RS',

  // Go
  go: 'GO',

  // C/C++
  c: 'C',
  h: 'H',
  cpp: 'C+',
  hpp: 'H+',

  // Ruby
  rb: 'RB',

  // SQL
  sql: 'SQ',

  // Binary / Archives
  zip: '\u{1F4E6}',
  gz: '\u{1F4E6}',
  tar: '\u{1F4E6}',
  wasm: 'WA',
};

/** Get a short text icon for a filename based on its extension. */
function getFileIcon(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1) {
    return '\u{2500}'; // generic file: em dash
  }
  const ext = filename.slice(dotIndex + 1).toLowerCase();
  return EXTENSION_ICONS[ext] ?? '\u{2500}';
}

/** Get a folder icon glyph. */
function getFolderIcon(isOpen: boolean): string {
  return isOpen ? '\u{1F4C2}' : '\u{1F4C1}';
}

// ---------------------------------------------------------------------------
// Style constants
// ---------------------------------------------------------------------------

const TREE_WIDTH = 220;
const ROW_HEIGHT = 24;
const OVERSCAN_COUNT = 10;
const INDENT = 12;

const headerStyle: React.CSSProperties = {
  padding: 'var(--space-xs) var(--space-sm)',
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-family), monospace',
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '0.15em',
  textTransform: 'uppercase' as const,
  userSelect: 'none',
  borderBottom: '1px solid var(--border-subtle)',
};

const containerStyle: React.CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--bg-surface)',
  overflow: 'hidden',
};

const treeContainerStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
};

// Loading skeleton
const skeletonContainerStyle: React.CSSProperties = {
  padding: 'var(--space-sm)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-xs)',
};

const skeletonLineStyle: React.CSSProperties = {
  height: '14px',
  borderRadius: '4px',
  background: 'var(--bg-elevated)',
  animation: 'breathe 2s ease-in-out infinite',
};

// Empty state
const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-family), monospace',
  fontSize: 'var(--font-small-size)',
  textAlign: 'center',
  padding: 'var(--space-md)',
  userSelect: 'none',
};

// ---------------------------------------------------------------------------
// Hint glow styles
// ---------------------------------------------------------------------------

/**
 * Returns a box-shadow value for the given hint style, or undefined if no hint.
 * The glow is applied as an inset box-shadow on the left edge of the row.
 */
function getHintGlow(style: ExplorerHintStyle | undefined): string | undefined {
  switch (style) {
    case 'subtle':
      return 'inset 2px 0 0 0 rgba(217, 119, 87, 0.3)';
    case 'obvious':
      return 'inset 3px 0 0 0 rgba(217, 119, 87, 0.6)';
    case 'unmissable':
      return 'inset 4px 0 0 0 rgba(217, 119, 87, 0.9)';
    default:
      return undefined;
  }
}

/**
 * Returns a CSS animation for the given hint style, or undefined if none.
 * Only the "unmissable" hint level gets a breathing animation.
 */
function getHintAnimation(
  style: ExplorerHintStyle | undefined,
): string | undefined {
  if (style === 'unmissable') {
    return 'breathe 2s ease-in-out infinite';
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Node renderer
// ---------------------------------------------------------------------------

/**
 * Context provided to the node renderer through a wrapper component.
 * We use a ref-based approach to avoid prop drilling through react-arborist.
 */
interface FileTreeContext {
  hints: Map<string, HintInfo>;
  activeFilePath: string | undefined;
  onFileClick: (path: string) => void;
}

/**
 * Custom node renderer for react-arborist.
 *
 * This is the `children` prop of the Tree component. It receives
 * NodeRendererProps and renders a single row with icon, name, and styling.
 */
function FileTreeNode({
  node,
  style,
  dragHandle,
  context,
}: NodeRendererProps<ArboristNode> & { context: FileTreeContext }) {
  const data = node.data;
  const isDirectory = data.type === 'directory';
  const isActive = context.activeFilePath === data.path;
  const hintInfo = context.hints.get(data.path);
  const hintStyle = hintInfo?.style;
  const hintGlow = getHintGlow(hintStyle);
  const hintAnimation = getHintAnimation(hintStyle);

  const handleClick = useCallback(() => {
    if (isDirectory) {
      node.toggle();
    } else {
      context.onFileClick(data.path);
    }
  }, [isDirectory, node, context, data.path]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  // Build row style
  const rowStyle: React.CSSProperties = {
    ...style,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    paddingRight: 'var(--space-xs)',
    cursor: 'pointer',
    fontFamily: 'var(--font-family), monospace',
    fontSize: 'var(--font-small-size)',
    lineHeight: `${ROW_HEIGHT}px`,
    color: isDirectory ? 'var(--text-secondary)' : 'var(--text-primary)',
    background: isActive ? 'rgba(217, 119, 87, 0.1)' : 'transparent',
    borderLeft: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
    boxShadow: hintGlow,
    animation: hintAnimation,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    userSelect: 'none',
  };

  // Arrow for directories
  const arrow = isDirectory ? (
    <span
      style={{
        fontSize: '8px',
        width: '10px',
        textAlign: 'center',
        flexShrink: 0,
        color: 'var(--text-muted)',
        transition: 'transform 150ms ease',
        transform: node.isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
        display: 'inline-block',
      }}
      aria-hidden="true"
    >
      {'\u25B6'}
    </span>
  ) : (
    <span style={{ width: '10px', flexShrink: 0 }} aria-hidden="true" />
  );

  // Icon
  const icon = isDirectory ? getFolderIcon(node.isOpen) : getFileIcon(data.name);
  const iconStyle: React.CSSProperties = {
    fontSize: isDirectory ? '12px' : '9px',
    width: '18px',
    textAlign: 'center',
    flexShrink: 0,
    opacity: isDirectory ? 0.8 : 0.7,
    letterSpacing: '-1px',
    fontWeight: isDirectory ? 400 : 700,
    color: isActive ? 'var(--accent-primary)' : undefined,
  };

  // Name
  const nameStyle: React.CSSProperties = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontWeight: isActive ? 600 : 400,
  };

  return (
    <div
      ref={dragHandle}
      style={rowStyle}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="treeitem"
      aria-expanded={isDirectory ? node.isOpen : undefined}
      aria-selected={isActive}
      title={data.path}
      tabIndex={0}
    >
      {arrow}
      <span style={iconStyle} aria-hidden="true">
        {icon}
      </span>
      <span style={nameStyle}>{data.name}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton sub-component
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  // Vary skeleton line widths for a realistic appearance
  const widths = ['70%', '55%', '80%', '45%', '65%', '50%', '75%'];

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>EXPLORER</div>
      <div style={skeletonContainerStyle} role="status" aria-label="Loading file tree">
        {widths.map((width, i) => (
          <div
            key={i}
            style={{
              ...skeletonLineStyle,
              width,
              animationDelay: `${i * 100}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state sub-component
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div style={containerStyle}>
      <div style={headerStyle}>EXPLORER</div>
      <div style={emptyStateStyle} role="status" aria-label="No files in project">
        No files in project
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FileTree component
// ---------------------------------------------------------------------------

export function FileTree({
  tree,
  hints,
  onFileClick,
  activeFilePath,
  autoExpandPaths,
}: FileTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const treeRef = useRef<any>(null);
  const [treeHeight, setTreeHeight] = useState(400);

  // Measure the available height for the tree
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Subtract the header height (approximately 28px)
        const available = entry.contentRect.height - 28;
        setTreeHeight(Math.max(available, 100));
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Auto-expand directories when hint autoExpandPaths change
  useEffect(() => {
    if (!autoExpandPaths || autoExpandPaths.size === 0 || !treeRef.current) {
      return;
    }

    // react-arborist's Tree ref exposes .open(id) to expand a node
    for (const path of autoExpandPaths) {
      try {
        treeRef.current.open(path);
      } catch {
        // Node may not exist in tree yet -- ignore silently
      }
    }
  }, [autoExpandPaths]);

  // Transform TreeNode data to react-arborist format
  const arboristData = useMemo(() => {
    if (!tree) return [];
    // If the root node is a directory, use its children as top-level items.
    // If it's a single file, wrap it in an array.
    if (tree.type === 'directory' && tree.children) {
      return tree.children.map(toArboristData);
    }
    return [toArboristData(tree)];
  }, [tree]);

  // Stable context object for the node renderer
  const context = useMemo<FileTreeContext>(
    () => ({
      hints,
      activeFilePath,
      onFileClick,
    }),
    [hints, activeFilePath, onFileClick],
  );

  // Node renderer that injects context
  const renderNode = useCallback(
    (props: NodeRendererProps<ArboristNode>) => (
      <FileTreeNode {...props} context={context} />
    ),
    [context],
  );

  // Handle null tree (loading)
  if (tree === null) {
    return <LoadingSkeleton />;
  }

  // Handle empty tree
  const hasChildren =
    tree.type === 'directory' && tree.children && tree.children.length > 0;
  if (!hasChildren && tree.type === 'directory') {
    return <EmptyState />;
  }

  return (
    <div style={containerStyle} ref={containerRef}>
      <div style={headerStyle}>EXPLORER</div>
      <div style={treeContainerStyle}>
        <Tree<ArboristNode>
          ref={treeRef}
          data={arboristData}
          width={TREE_WIDTH}
          height={treeHeight}
          rowHeight={ROW_HEIGHT}
          overscanCount={OVERSCAN_COUNT}
          indent={INDENT}
          openByDefault={false}
          disableDrag={true}
          disableDrop={true}
          disableEdit={true}
          disableMultiSelection={true}
          selection={activeFilePath}
          childrenAccessor="children"
          idAccessor="id"
        >
          {renderNode}
        </Tree>
      </div>
    </div>
  );
}
