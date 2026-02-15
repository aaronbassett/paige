// WebSocket handlers for pr:suggest and pr:create messages.
// Generates AI-powered PR descriptions and creates pull requests via the GitHub API.

import type { WebSocket as WsWebSocket } from 'ws';
import { z } from 'zod';
import type { PrCreateData } from '../../types/websocket.js';
import { getLogger } from '../../logger/logtape.js';
import { getActiveRepo, getActiveSessionId } from '../../mcp/session.js';
import { getDatabase } from '../../database/db.js';

const logger = getLogger(['paige', 'ws-handler', 'pr']);
import { loadEnv } from '../../config/env.js';
import { broadcast } from '../server.js';
import { callApi } from '../../api-client/claude.js';
import { gitLog, gitPush } from '../../git/service.js';
import { createPullRequest } from '../../git/pr.js';

const prSuggestionSchema = z.object({
  title: z.string(),
  body: z.string(),
});

/**
 * Handles `pr:suggest` messages from Electron clients.
 *
 * Reads the git log (main..HEAD) and all phase descriptions, then calls
 * the Claude API (haiku) to generate a PR title and body.
 * Broadcasts `pr:suggestion` on success or `pr:error` on failure.
 */
export function handlePrSuggest(_ws: WsWebSocket, _data: unknown, _connectionId: string): void {
  void (async () => {
    const activeRepo = getActiveRepo();
    const env = loadEnv();
    const projectDir = activeRepo
      ? `${env.dataDir}/repos/${activeRepo.owner}/${activeRepo.repo}`
      : env.dataDir;

    const sessionId = getActiveSessionId();
    const db = getDatabase();

    // Get git log
    const log = await gitLog('main..HEAD', projectDir);

    // Get phase info and issue context
    let context = '';
    if (db !== null && sessionId !== null) {
      const activePlan = await db
        .selectFrom('plans')
        .selectAll()
        .where('session_id', '=', sessionId)
        .where('is_active', '=', 1)
        .executeTakeFirst();

      if (activePlan) {
        const phases = await db
          .selectFrom('phases')
          .selectAll()
          .where('plan_id', '=', activePlan.id)
          .orderBy('number', 'asc')
          .execute();

        context = phases.map((p) => `Phase ${p.number}: ${p.title} - ${p.description}`).join('\n');
      }
    }

    const suggestion = await callApi({
      callType: 'pr_suggest',
      model: 'haiku',
      systemPrompt:
        'You are a PR description generator. Generate a clear, concise PR title and body based on the git log and context. The body should use markdown with a summary section.',
      userMessage: `Git log:\n${log}\n\nContext:\n${context}`,
      responseSchema: prSuggestionSchema,
      sessionId,
    });

    broadcast({
      type: 'pr:suggestion',
      data: suggestion,
    } as never);
  })().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'PR suggestion failed';
    logger.error`Suggestion failed: ${message}`;
    broadcast({
      type: 'pr:error',
      data: { error: message },
    } as never);
  });
}

/**
 * Handles `pr:create` messages from Electron clients.
 *
 * Pushes the working branch to origin and creates a pull request via
 * the GitHub API. Broadcasts `pr:created` on success or `pr:error` on failure.
 */
export function handlePrCreate(_ws: WsWebSocket, data: unknown, _connectionId: string): void {
  const { title, body } = data as PrCreateData;

  void (async () => {
    const activeRepo = getActiveRepo();
    if (activeRepo === null) {
      throw new Error('No active repo');
    }

    const env = loadEnv();
    const projectDir = `${env.dataDir}/repos/${activeRepo.owner}/${activeRepo.repo}`;

    // Get the branch name from the session record
    const sessionId = getActiveSessionId();
    const db = getDatabase();
    let branchName = 'main';

    if (db !== null && sessionId !== null) {
      const session = await db
        .selectFrom('sessions')
        .selectAll()
        .where('id', '=', sessionId)
        .executeTakeFirst();

      if (session?.branch_name) {
        branchName = session.branch_name;
      }
    }

    // Push the branch
    await gitPush(branchName, projectDir);

    // Create the PR
    const result = await createPullRequest(
      activeRepo.owner,
      activeRepo.repo,
      branchName,
      'main',
      title,
      body,
    );

    broadcast({
      type: 'pr:created',
      data: result,
    } as never);
  })().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'PR creation failed';
    logger.error`PR creation failed: ${message}`;
    broadcast({
      type: 'pr:error',
      data: { error: message },
    } as never);
  });
}
