// WebSocket handlers for session:start_repo and session:select_issue messages.
// Manages repo cloning, session creation, and issue streaming pipeline kickoff.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import type { WebSocket as WsWebSocket } from 'ws';
import { sendToClient } from '../server.js';
import { loadEnv } from '../../config/env.js';
import { setActiveRepo, getActiveSessionId } from '../../mcp/session.js';
import { getDatabase } from '../../database/db.js';
import { updateSession } from '../../database/queries/sessions.js';
import { assembleAndStreamIssues } from '../../dashboard/flows/issues.js';
import type {
  SessionStartRepoData,
  SessionSelectIssueWsData,
  SessionRepoStartedMessage,
  SessionIssueSelectedResponseMessage,
} from '../../types/websocket.js';

/**
 * Handles `session:start_repo` messages from Electron clients.
 *
 * 1. Validates owner/repo strings
 * 2. Checks if the repo is already cloned at `~/.paige/repos/{owner}/{repo}/`
 * 3. If not, runs `git clone --depth=1` to fetch it
 * 4. Sets the active repo context
 * 5. Sends `session:repo_started` confirmation
 * 6. Kicks off issue streaming pipeline in the background as a head-start
 */
export function handleSessionStartRepo(
  _ws: WsWebSocket,
  data: unknown,
  connectionId: string,
): void {
  const { owner, repo } = data as SessionStartRepoData;

  // Validate owner and repo are non-empty strings
  if (!owner || !repo) {
    // eslint-disable-next-line no-console
    console.error('[ws-handler:session-start] Missing owner or repo in session:start_repo');
    return;
  }

  const env = loadEnv();
  const repoDir = join(env.dataDir, 'repos', owner, repo);

  // Clone the repo if it doesn't exist locally
  if (!existsSync(repoDir)) {
    try {
      const cloneUrl = `https://github.com/${owner}/${repo}.git`;
      // eslint-disable-next-line no-console
      console.log(`[ws-handler:session-start] Cloning ${cloneUrl} to ${repoDir}`);
      execSync(`git clone "${cloneUrl}" "${repoDir}"`, {
        stdio: 'pipe',
        timeout: 60_000, // 60 second timeout for clone
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `[ws-handler:session-start] Failed to clone ${owner}/${repo}:`,
        err instanceof Error ? err.message : err,
      );
      return;
    }
  }

  // Set the active repo context for other handlers/flows
  setActiveRepo(owner, repo);

  // Confirm to the client that the repo is ready
  sendToClient(connectionId, {
    type: 'session:repo_started',
    data: { owner, repo },
  } as SessionRepoStartedMessage);

  // Kick off issue streaming pipeline in the background as a head-start.
  // Don't await — this runs concurrently while the user picks an issue.
  void assembleAndStreamIssues(owner, repo, connectionId).catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error(
      '[ws-handler:session-start] Background issue streaming failed:',
      err instanceof Error ? err.message : err,
    );
  });
}

/**
 * Handles `session:select_issue` messages from Electron clients.
 *
 * Session was already resolved by the router's pre-dispatch step.
 * This handler just associates the issue with the existing session.
 */
export async function handleSessionSelectIssue(
  _ws: WsWebSocket,
  data: unknown,
  connectionId: string,
): Promise<void> {
  const { issueNumber } = data as SessionSelectIssueWsData;

  const sessionId = getActiveSessionId();
  if (sessionId === null) {
    // eslint-disable-next-line no-console
    console.error('[ws-handler:session-start] No active session for issue selection');
    return;
  }

  const db = getDatabase();
  if (db === null) {
    // eslint-disable-next-line no-console
    console.error('[ws-handler:session-start] Database not available for issue association');
    return;
  }

  // Associate the issue with the existing session
  await updateSession(db, sessionId, {
    issue_number: issueNumber,
  });

  sendToClient(connectionId, {
    type: 'session:issue_selected',
    data: { sessionId, issueNumber },
  } as SessionIssueSelectedResponseMessage);
}
