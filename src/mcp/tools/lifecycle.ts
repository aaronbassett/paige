// MCP Lifecycle tools — paige_start_session, paige_end_session

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getDatabase } from '../../database/db.js';
import { createSession, updateSession } from '../../database/queries/sessions.js';
import { getActiveSessionId, setActiveSessionId, clearActiveSessionId } from '../session.js';

/** Registers lifecycle tools (paige_start_session, paige_end_session) on the MCP server. */
export function registerLifecycleTools(server: McpServer): void {
  // ── paige_start_session ────────────────────────────────────────────────────

  server.tool(
    'paige_start_session',
    'Create a new coaching session.',
    {
      project_dir: z.string().describe('Absolute path to the project directory'),
      issue_number: z.number().int().optional().describe('GitHub issue number'),
      issue_title: z.string().optional().describe('GitHub issue title'),
    },
    async ({ project_dir, issue_number, issue_title }) => {
      // Guard: only one active session at a time
      if (getActiveSessionId() !== null) {
        return {
          content: [{ type: 'text' as const, text: 'A session is already active' }],
          isError: true,
        };
      }

      const db = getDatabase();
      if (db === null) {
        return {
          content: [{ type: 'text' as const, text: 'Database not initialized' }],
          isError: true,
        };
      }

      const session = await createSession(db, {
        project_dir,
        status: 'active',
        started_at: new Date().toISOString(),
        issue_number: issue_number ?? null,
        issue_title: issue_title ?? null,
      });

      setActiveSessionId(session.id);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              session_id: session.id,
              project_dir: session.project_dir,
              status: session.status,
            }),
          },
        ],
      };
    },
  );

  // ── paige_end_session ──────────────────────────────────────────────────────

  server.tool('paige_end_session', 'End the current coaching session.', {}, async () => {
    const sessionId = getActiveSessionId();

    if (sessionId === null) {
      return {
        content: [{ type: 'text' as const, text: 'No active session to end' }],
        isError: true,
      };
    }

    const db = getDatabase();
    if (db === null) {
      return {
        content: [{ type: 'text' as const, text: 'Database not initialized' }],
        isError: true,
      };
    }

    await updateSession(db, sessionId, {
      status: 'completed',
      ended_at: new Date().toISOString(),
    });

    clearActiveSessionId();

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            session_id: sessionId,
            status: 'completed',
          }),
        },
      ],
    };
  });
}
