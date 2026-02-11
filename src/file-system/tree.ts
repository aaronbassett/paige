// Project tree scanning with noise directory filtering
// Implements FR-033, FR-034

import { readdir } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';

/** A node in the project file tree. */
export interface TreeNode {
  name: string;
  path: string; // relative to PROJECT_DIR
  type: 'file' | 'directory';
  children?: TreeNode[];
}

/** Directories excluded from tree scanning to reduce noise. */
const NOISE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.cache',
]);

/**
 * Sorts TreeNode arrays: directories first, then files, alphabetically within each group.
 */
function sortNodes(nodes: TreeNode[]): TreeNode[] {
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Recursively scans a directory and builds an array of TreeNode children.
 * @param dirPath - Absolute path to the directory to scan
 * @param projectDir - Absolute path to the project root (used for relative paths)
 */
async function scanDir(dirPath: string, projectDir: string): Promise<TreeNode[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const nodes: TreeNode[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() && NOISE_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = join(dirPath, entry.name);
    const relPath = relative(projectDir, fullPath);

    if (entry.isDirectory()) {
      const children = await scanDir(fullPath, projectDir);
      nodes.push({
        name: entry.name,
        path: relPath,
        type: 'directory',
        children,
      });
    } else {
      nodes.push({ name: entry.name, path: relPath, type: 'file' });
    }
  }

  return sortNodes(nodes);
}

/**
 * Scans PROJECT_DIR recursively and returns a tree structure.
 * Excludes noise directories: node_modules, .git, dist, build, coverage, .next, .cache
 * @param projectDir - Root directory to scan
 * @returns The root TreeNode with children
 */
export async function getProjectTree(projectDir: string): Promise<TreeNode> {
  const children = await scanDir(projectDir, projectDir);

  return {
    name: basename(projectDir),
    path: '.',
    type: 'directory',
    children,
  };
}
