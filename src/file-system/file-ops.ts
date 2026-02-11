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

/** Extension-to-language mapping for detectLanguage. */
const EXTENSION_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescriptreact',
  '.js': 'javascript',
  '.jsx': 'javascriptreact',
  '.py': 'python',
  '.rb': 'ruby',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.css': 'css',
  '.html': 'html',
  '.json': 'json',
  '.md': 'markdown',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.sh': 'shellscript',
  '.sql': 'sql',
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
 * Returns content and detected language identifier based on extension.
 * @param filePath - Path to read (relative to projectDir or absolute within it)
 * @param projectDir - The root project directory boundary
 */
export async function readFile(filePath: string, projectDir: string): Promise<FileReadResult> {
  const resolvedPath = validatePath(filePath, projectDir);
  const content = await fs.readFile(resolvedPath, 'utf-8');
  const language = detectLanguage(resolvedPath);

  return { content, language };
}

/**
 * Writes content to a file within PROJECT_DIR (Electron-only).
 * Updates buffer cache to dirty: false after successful write.
 * @param filePath - Path to write (relative to projectDir or absolute within it)
 * @param content - File content to write
 * @param projectDir - The root project directory boundary
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
 * Returns empty string if buffer is clean or missing.
 * @param filePath - Path to diff (relative to projectDir or absolute within it)
 * @param projectDir - The root project directory boundary
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
  return EXTENSION_MAP[ext] ?? 'plaintext';
}
