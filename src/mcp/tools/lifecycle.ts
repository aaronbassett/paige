// MCP Lifecycle tools — paige_start_session, paige_end_session

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getDatabase } from '../../database/db.js';
import { createSession } from '../../database/queries/sessions.js';
import { getActiveSessionId, setActiveSessionId, clearActiveSessionId } from '../session.js';
import { runSessionWrapUp } from '../../coaching/wrap-up.js';
import { Observer } from '../../observer/observer.js';

// ── Active Observer ────────────────────────────────────────────────────────────

let activeObserver: Observer | null = null;

/** Returns the active Observer instance, or null if no session is running. */
export function getActiveObserver(): Observer | null {
  return activeObserver;
}

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
          content: [
            {
              type: 'text' as const,
              text: 'A session is already active. End it with paige_end_session before starting a new one.',
            },
          ],
          isError: true,
        };
      }

      const db = getDatabase();
      if (db === null) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Database not initialized. The server may not have started correctly.',
            },
          ],
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

      // Create and start the Observer for this session
      activeObserver = new Observer({ sessionId: session.id });
      activeObserver.start();

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
        content: [
          {
            type: 'text' as const,
            text: 'No active session to end. Start one with paige_start_session first.',
          },
        ],
        isError: true,
      };
    }

    try {
      // Stop the Observer before wrap-up
      if (activeObserver !== null) {
        activeObserver.stop();
        activeObserver = null;
      }

      const result = await runSessionWrapUp(sessionId);

      clearActiveSessionId();

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              session_id: sessionId,
              memories_added: result.memoriesAdded,
              gaps_identified: result.gapsIdentified,
              katas_generated: result.katasGenerated,
              assessments_updated: result.assessmentsUpdated,
            }),
          },
        ],
      };
    } catch (error: unknown) {
      // Ensure Observer is stopped on error
      if (activeObserver !== null) {
        activeObserver.stop();
        activeObserver = null;
      }

      clearActiveSessionId();

      const message = error instanceof Error ? error.message : String(error);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              session_id: sessionId,
              error: message,
            }),
          },
        ],
        isError: true,
      };
    }
  });
}
