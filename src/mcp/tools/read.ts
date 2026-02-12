// MCP Read tools — paige_get_buffer, paige_get_open_files, paige_get_diff, paige_get_session_state
// Implements FR-097 through FR-100

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getBuffer, getAllPaths, getDirtyPaths } from '../../file-system/buffer-cache.js';
import { getDiff } from '../../file-system/file-ops.js';
import { loadEnv } from '../../config/env.js';
import { getDatabase } from '../../database/db.js';
import { getSession } from '../../database/queries/sessions.js';
import { getActiveSessionId } from '../session.js';

/** Registers read tools on the MCP server. */
export function registerReadTools(server: McpServer): void {
  registerGetBuffer(server);
  registerGetOpenFiles(server);
  registerGetDiff(server);
  registerGetSessionState(server);
}

// ── paige_get_buffer ───────────────────────────────────────────────────────

function registerGetBuffer(server: McpServer): void {
  server.tool(
    'paige_get_buffer',
    'Returns the current buffer content, dirty state, and cursor position for an open file',
    { path: z.string() },
    ({ path }) => {
      const buffer = getBuffer(path);

      if (buffer === null) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ content: null }) }],
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              content: buffer.content,
              dirty: buffer.dirty,
              cursorPosition: buffer.cursorPosition,
              lastUpdated: buffer.lastUpdated,
            }),
          },
        ],
      };
    },
  );
}

// ── paige_get_open_files ────────────────────────────────────────────────────

function registerGetOpenFiles(server: McpServer): void {
  server.tool(
    'paige_get_open_files',
    'Returns the list of all currently open file paths in the editor',
    {},
    () => {
      const files = getAllPaths();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ files }) }],
      };
    },
  );
}

// ── paige_get_diff ──────────────────────────────────────────────────────────

function registerGetDiff(server: McpServer): void {
  server.tool(
    'paige_get_diff',
    'Returns unified diff between saved file(s) on disk and buffer content. Provide path for a single file, or omit for all dirty buffers.',
    { path: z.string().optional() },
    async ({ path }) => {
      const { projectDir } = loadEnv();

      if (path !== undefined) {
        // Single file diff
        const diff = await getDiff(path, projectDir);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ diff }) }],
        };
      }

      // All dirty files
      const dirtyPaths = getDirtyPaths();
      const diffs: { path: string; diff: string }[] = [];

      for (const dirtyPath of dirtyPaths) {
        const diff = await getDiff(dirtyPath, projectDir);
        if (diff !== '') {
          diffs.push({ path: dirtyPath, diff });
        }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ diffs }) }],
      };
    },
  );
}

// ── paige_get_session_state ─────────────────────────────────────────────────

function registerGetSessionState(server: McpServer): void {
  server.tool(
    'paige_get_session_state',
    'Returns the current coaching session state including session ID, project directory, and status',
    { include: z.array(z.string()).optional() },
    async () => {
      const sessionId = getActiveSessionId();

      if (sessionId === null) {
        return {
          content: [
            { type: 'text' as const, text: JSON.stringify({ error: 'No active session' }) },
          ],
          isError: true,
        };
      }

      const db = getDatabase();
      if (db === null) {
        return {
          content: [
            { type: 'text' as const, text: JSON.stringify({ error: 'Database not initialized' }) },
          ],
          isError: true,
        };
      }

      const session = await getSession(db, sessionId);
      if (session === undefined) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: `Session ${sessionId} not found` }),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              session_id: session.id,
              project_dir: session.project_dir,
              status: session.status,
              started_at: session.started_at,
              issue_number: session.issue_number,
              issue_title: session.issue_title,
            }),
          },
        ],
      };
    },
  );
}
