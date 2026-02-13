// MCP Lifecycle tools — paige_start_session, paige_end_session

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getDatabase } from '../../database/db.js';
import { updateSession } from '../../database/queries/sessions.js';
import { getActiveSessionId, clearActiveSessionId } from '../session.js';
import { resolveSession } from '../../session/resolve.js';
import { runSessionWrapUp } from '../../coaching/wrap-up.js';
import { Observer } from '../../observer/observer.js';

// ── Active Observer ────────────────────────────────────────────────────────────

let activeObserver: Observer | null = null;

/** Returns the active Observer instance, or null if no session is running. */
export function getActiveObserver(): Observer | null {
  return activeObserver;
}

/** Stops the active Observer if one is running. */
export function stopActiveObserver(): void {
  if (activeObserver !== null) {
    activeObserver.stop();
    activeObserver = null;
  }
}

/** Creates and starts an Observer for the given session ID. */
export function startObserverForSession(sessionId: number): void {
  stopActiveObserver();
  activeObserver = new Observer({ sessionId });
  activeObserver.start();
}

/** Registers lifecycle tools (paige_start_session, paige_end_session) on the MCP server. */
export function registerLifecycleTools(server: McpServer): void {
  // ── paige_start_session ────────────────────────────────────────────────────

  server.tool(
    'paige_start_session',
    'Create or resume a coaching session. Idempotent — returns existing active session if within timeout.',
    {
      project_dir: z.string().describe('Absolute path to the project directory'),
      issue_number: z.number().int().optional().describe('GitHub issue number'),
      issue_title: z.string().optional().describe('GitHub issue title'),
    },
    async ({ project_dir: _project_dir, issue_number, issue_title }) => {
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

      // Resolve to an existing or new session (idempotent)
      const { sessionId } = await resolveSession();

      // If issue info was provided, associate it with the session
      if (issue_number !== undefined || issue_title !== undefined) {
        await updateSession(db, sessionId, {
          issue_number: issue_number ?? null,
          issue_title: issue_title ?? null,
        });
      }

      // Start Observer only if not already running
      if (activeObserver === null) {
        startObserverForSession(sessionId);
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              session_id: sessionId,
              status: 'active',
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
      stopActiveObserver();

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
      stopActiveObserver();

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
