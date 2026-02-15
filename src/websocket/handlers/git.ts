// WebSocket handlers for git operations: status, save-and-exit, discard-and-exit.
// Wraps the git service functions and broadcasts results to connected clients.

import type { WebSocket as WsWebSocket } from 'ws';
import { getLogger } from '../../logger/logtape.js';
import { getActiveRepo, getActiveSessionId } from '../../mcp/session.js';
import { getDatabase } from '../../database/db.js';

const logger = getLogger(['paige', 'ws-handler', 'git']);
import { loadEnv } from '../../config/env.js';
import { broadcast } from '../server.js';
import { updateSession } from '../../database/queries/sessions.js';
import {
  gitStatus,
  gitAddAll,
  gitStashPush,
  gitCheckout,
  gitRevertAll,
} from '../../git/service.js';

/**
 * Handles `git:status` messages from Electron clients.
 *
 * Runs `git status --porcelain` in the active project directory and
 * broadcasts the parsed result as `git:status_result`.
 */
export function handleGitStatus(_ws: WsWebSocket, _data: unknown, _connectionId: string): void {
  void (async () => {
    const activeRepo = getActiveRepo();
    const env = loadEnv();
    const projectDir = activeRepo
      ? `${env.dataDir}/repos/${activeRepo.owner}/${activeRepo.repo}`
      : env.dataDir;

    const status = await gitStatus(projectDir);

    broadcast({
      type: 'git:status_result',
      data: status,
    } as never);
  })().catch((err: unknown) => {
    logger.error`Status check failed: ${err}`;
  });
}

/**
 * Handles `git:save_and_exit` messages from Electron clients.
 *
 * Stages all changes, creates a named git stash, records the stash name
 * in the session record, and checks out main. Broadcasts `git:exit_complete`
 * when done.
 */
export function handleGitSaveAndExit(
  _ws: WsWebSocket,
  _data: unknown,
  _connectionId: string,
): void {
  void (async () => {
    const activeRepo = getActiveRepo();
    const env = loadEnv();
    const projectDir = activeRepo
      ? `${env.dataDir}/repos/${activeRepo.owner}/${activeRepo.repo}`
      : env.dataDir;

    const sessionId = getActiveSessionId();
    const db = getDatabase();

    // Build a descriptive stash name
    const stashName = `paige-${sessionId ?? 0}-${Date.now()}`;

    // Stage all and stash
    await gitAddAll(projectDir);
    await gitStashPush(stashName, projectDir);

    // Store stash name in session record for later retrieval
    if (db !== null && sessionId !== null) {
      await updateSession(db, sessionId, { stash_name: stashName });
    }

    // Checkout main
    await gitCheckout('main', projectDir);

    broadcast({
      type: 'git:exit_complete',
      data: {},
    } as never);
  })().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Save and exit failed';
    logger.error`Save and exit failed: ${message}`;
  });
}

/**
 * Handles `git:discard_and_exit` messages from Electron clients.
 *
 * Reverts all working tree changes (tracked and untracked) and checks
 * out main. Broadcasts `git:exit_complete` when done.
 */
export function handleGitDiscardAndExit(
  _ws: WsWebSocket,
  _data: unknown,
  _connectionId: string,
): void {
  void (async () => {
    const activeRepo = getActiveRepo();
    const env = loadEnv();
    const projectDir = activeRepo
      ? `${env.dataDir}/repos/${activeRepo.owner}/${activeRepo.repo}`
      : env.dataDir;

    // Revert all changes and checkout main
    await gitRevertAll(projectDir);
    await gitCheckout('main', projectDir);

    broadcast({
      type: 'git:exit_complete',
      data: {},
    } as never);
  })().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Discard and exit failed';
    logger.error`Discard and exit failed: ${message}`;
  });
}
