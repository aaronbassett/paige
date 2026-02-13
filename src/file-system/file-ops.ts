// File operations: read, write, getDiff with path security validation
// Implements FR-023 through FR-032

import { resolve, extname, dirname, sep } from 'node:path';
import { realpathSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import { createTwoFilesPatch } from 'diff';
import { getBuffer, markClean } from './buffer-cache.js';

/** Result of reading a file. */
export interface FileReadResult {
  content: string;
  language: string;
}

/**
 * Extension-to-language mapping for detectLanguage.
 * Uses standalone Monaco editor language IDs (not VS Code IDs).
 * Monaco uses 'typescript' for both .ts/.tsx and 'javascript' for .js/.jsx.
 */
const EXTENSION_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.rb': 'ruby',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.html': 'html',
  '.htm': 'html',
  '.json': 'json',
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.xml': 'xml',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.sql': 'sql',
  '.graphql': 'graphql',
  '.gql': 'graphql',
  '.dockerfile': 'dockerfile',
  '.toml': 'ini',
  '.ini': 'ini',
  '.env': 'ini',
};

/**
 * Validates that a path resolves within the project directory.
 * Rejects path traversal attempts before any I/O occurs.
 * @param filePath - The path to validate (absolute or relative to projectDir)
 * @param projectDir - The root project directory boundary
 * @returns The resolved absolute path if valid
 * @throws Error if path resolves outside projectDir
 */
export function validatePath(filePath: string, projectDir: string): string {
  // Reject empty or whitespace-only paths
  if (!filePath || filePath.trim().length === 0) {
    throw new Error('Path must not be empty');
  }

  // Reject null byte injection
  if (filePath.includes('\0')) {
    throw new Error('Path must not contain null bytes');
  }

  // Resolve the project directory through symlinks
  let realProjectDir: string;
  try {
    realProjectDir = realpathSync(projectDir);
  } catch {
    // If projectDir itself doesn't exist, just use the resolved form
    realProjectDir = resolve(projectDir);
  }

  // Resolve the file path (absolute or relative to projectDir)
  const resolved = resolve(realProjectDir, filePath);

  // Attempt to resolve symlinks on the file path
  let realResolved: string;
  try {
    realResolved = realpathSync(resolved);
  } catch {
    // File may not exist yet (e.g., for writeFile creating new files)
    // Fall back to the logically resolved path
    realResolved = resolved;
  }

  // Validate that the resolved path is within the project directory.
  // Must equal projectDir or start with projectDir + separator to prevent
  // prefix attacks (e.g., /tmp/abc-evil matching /tmp/abc).
  if (realResolved !== realProjectDir && !realResolved.startsWith(realProjectDir + sep)) {
    throw new Error(`Path "${filePath}" resolves outside the project directory`);
  }

  return realResolved;
}

/**
 * Reads a file from within PROJECT_DIR.
 * @param filePath - Path to read (relative to projectDir or absolute within it)
 * @param projectDir - The root project directory boundary
 * @returns File content and detected language identifier based on extension
 * @throws {Error} If path resolves outside projectDir or file does not exist
 */
export async function readFile(filePath: string, projectDir: string): Promise<FileReadResult> {
  const resolvedPath = validatePath(filePath, projectDir);
  const content = await fs.readFile(resolvedPath, 'utf-8');
  const language = detectLanguage(resolvedPath);

  return { content, language };
}

/**
 * Writes content to a file within PROJECT_DIR (Electron-only).
 * Creates parent directories if needed and marks the buffer clean after write.
 * @param filePath - Path to write (relative to projectDir or absolute within it)
 * @param content - File content to write
 * @param projectDir - The root project directory boundary
 * @throws {Error} If path resolves outside projectDir
 */
export async function writeFile(
  filePath: string,
  content: string,
  projectDir: string,
): Promise<void> {
  const resolvedPath = validatePath(filePath, projectDir);
  await fs.mkdir(dirname(resolvedPath), { recursive: true });
  await fs.writeFile(resolvedPath, content, 'utf-8');
  markClean(resolvedPath);
}

/**
 * Computes a unified diff between saved file on disk and buffer content.
 * @param filePath - Path to diff (relative to projectDir or absolute within it)
 * @param projectDir - The root project directory boundary
 * @returns Unified diff string, or empty string if buffer is clean or missing
 * @throws {Error} If path resolves outside projectDir
 */
export async function getDiff(filePath: string, projectDir: string): Promise<string> {
  const resolvedPath = validatePath(filePath, projectDir);
  const buffer = getBuffer(resolvedPath);

  // No buffer or buffer is clean -- no diff to report
  if (buffer === null || !buffer.dirty) {
    return '';
  }

  // Read the saved version from disk
  const savedContent = await fs.readFile(resolvedPath, 'utf-8');

  // Compute unified diff between saved (disk) and buffer (in-memory edits)
  const diff = createTwoFilesPatch(resolvedPath, resolvedPath, savedContent, buffer.content);

  return diff;
}

/**
 * Detects programming language from file extension.
 * @param filePath - File path to detect language from
 * @returns Language identifier string
 */
export function detectLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  if (ext) {
    return EXTENSION_MAP[ext] ?? 'plaintext';
  }

  // Handle extensionless files by filename
  const filename = filePath.split('/').pop()?.toLowerCase() ?? '';
  const FILENAME_MAP: Record<string, string> = {
    'dockerfile': 'dockerfile',
    'makefile': 'shell',
    '.gitignore': 'ini',
    '.env': 'ini',
    '.env.local': 'ini',
    '.env.example': 'ini',
  };
  return FILENAME_MAP[filename] ?? 'plaintext';
}
