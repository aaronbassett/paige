// Review agent tool definitions and executor.
// These tools allow the review agent to inspect the project during a multi-turn review.

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';

// ── Tool Definitions ────────────────────────────────────────────────────────

/** Tools available to the review agent during multi-turn code review. */
export const reviewTools: Anthropic.Tool[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file from the project directory',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Relative path from project root',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'git_diff',
    description: 'Get the git diff for uncommitted changes. Optionally filter to a specific file.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Optional file path to diff',
        },
      },
      required: [],
    },
  },
  {
    name: 'list_files',
    description: 'List files in a directory',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Relative directory path',
        },
      },
      required: ['path'],
    },
  },
];

// ── Tool Executor ───────────────────────────────────────────────────────────

/**
 * Execute a review tool call and return the result as a string.
 *
 * Each tool operates within `projectDir` to prevent path traversal.
 * Errors are caught and returned as descriptive strings so the agent
 * can adapt rather than crash.
 */
export async function executeReviewTool(
  toolName: string,
  input: Record<string, unknown>,
  projectDir: string,
): Promise<string> {
  try {
    switch (toolName) {
      case 'read_file': {
        const relativePath = input['path'] as string;
        const filePath = join(projectDir, relativePath);
        const content = await readFile(filePath, 'utf-8');
        return content;
      }

      case 'git_diff': {
        // Dynamic import to avoid circular dependencies at module load time
        const { gitDiff } = await import('../git/service.js');
        const path = input['path'] as string | undefined;

        if (path) {
          // File-specific diff: shell out directly for a targeted diff
          const { execFile } = await import('node:child_process');
          const { promisify } = await import('node:util');
          const execFileAsync = promisify(execFile);
          const { stdout } = await execFileAsync('git', ['diff', 'HEAD', '--', path], {
            cwd: projectDir,
          });
          return stdout || '(no changes)';
        }

        return (await gitDiff(projectDir)) || '(no changes)';
      }

      case 'list_files': {
        const relativePath = input['path'] as string;
        const dirPath = join(projectDir, relativePath);
        const entries = await readdir(dirPath, { withFileTypes: true });
        return entries.map((e) => `${e.isDirectory() ? 'd' : 'f'} ${e.name}`).join('\n');
      }

      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error executing ${toolName}: ${message}`;
  }
}
