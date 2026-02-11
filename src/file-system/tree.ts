// Project tree scanning with noise directory filtering
// Implements FR-033, FR-034

/** A node in the project file tree. */
export interface TreeNode {
  name: string;
  path: string; // relative to PROJECT_DIR
  type: 'file' | 'directory';
  children?: TreeNode[];
}

/**
 * Scans PROJECT_DIR recursively and returns a tree structure.
 * Excludes noise directories: node_modules, .git, dist, build, coverage, .next, .cache
 * @param projectDir - Root directory to scan
 * @returns The root TreeNode with children
 */
export function getProjectTree(_projectDir: string): Promise<TreeNode> {
  return Promise.reject(new Error('Not implemented'));
}
