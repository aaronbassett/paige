// WebSocket handlers for commit:suggest and commit:execute messages.
// Generates AI-powered commit messages and executes git commits.

import type { WebSocket as WsWebSocket } from 'ws';
import { z } from 'zod';
import type { CommitExecuteData } from '../../types/websocket.js';
import { getActiveRepo, getActiveSessionId } from '../../mcp/session.js';
import { getDatabase } from '../../database/db.js';
import { loadEnv } from '../../config/env.js';
import { broadcast } from '../server.js';
import { callApi } from '../../api-client/claude.js';
import { gitAddAll, gitCommit, gitDiff } from '../../git/service.js';

const commitSuggestionSchema = z.object({
  type: z.enum([
    'fix',
    'feat',
    'docs',
    'style',
    'refactor',
    'test',
    'chore',
    'perf',
    'ci',
    'build',
  ]),
  subject: z.string(),
  body: z.string(),
});

/**
 * Handles `commit:suggest` messages from Electron clients.
 *
 * Reads the current git diff and active phase context, then calls
 * the Claude API (haiku) to generate a conventional commit message.
 * Broadcasts `commit:suggestion` on success or `commit:error` on failure.
 */
export function handleCommitSuggest(_ws: WsWebSocket, _data: unknown, _connectionId: string): void {
  void (async () => {
    const activeRepo = getActiveRepo();
    const env = loadEnv();
    const projectDir = activeRepo
      ? `${env.dataDir}/repos/${activeRepo.owner}/${activeRepo.repo}`
      : env.dataDir;

    const sessionId = getActiveSessionId();
    const db = getDatabase();

    // Get git diff
    const diff = await gitDiff(projectDir);

    // Get phase info for context
    let phaseInfo = '';
    if (db !== null && sessionId !== null) {
      const activePlan = await db
        .selectFrom('plans')
        .selectAll()
        .where('session_id', '=', sessionId)
        .where('is_active', '=', 1)
        .executeTakeFirst();

      if (activePlan) {
        const activePhase = await db
          .selectFrom('phases')
          .selectAll()
          .where('plan_id', '=', activePlan.id)
          .where('status', '=', 'active')
          .executeTakeFirst();

        if (activePhase) {
          phaseInfo = `Phase: ${activePhase.title}\nDescription: ${activePhase.description}`;
        }
      }
    }

    const suggestion = await callApi({
      callType: 'commit_suggest',
      model: 'haiku',
      systemPrompt:
        'You are a commit message generator. Generate a conventional commit message based on the git diff and context provided. Return JSON with type, subject (brief, imperative mood, no period), and body (detailed explanation).',
      userMessage: `${phaseInfo}\n\nGit diff:\n${diff.slice(0, 8000)}`,
      responseSchema: commitSuggestionSchema,
      sessionId,
    });

    broadcast({
      type: 'commit:suggestion',
      data: suggestion,
    } as never);
  })().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Commit suggestion failed';
    // eslint-disable-next-line no-console
    console.error('[commit] Suggestion failed:', message);
    broadcast({
      type: 'commit:error',
      data: { error: message },
    } as never);
  });
}

/**
 * Handles `commit:execute` messages from Electron clients.
 *
 * Stages all changes, creates a conventional commit, and transitions
 * the active phase to complete (activating the next phase if one exists).
 * Broadcasts `phase:transition` for each phase change, or `commit:error` on failure.
 */
export function handleCommitExecute(_ws: WsWebSocket, data: unknown, _connectionId: string): void {
  const { type, subject, body } = data as CommitExecuteData;

  void (async () => {
    const activeRepo = getActiveRepo();
    const env = loadEnv();
    const projectDir = activeRepo
      ? `${env.dataDir}/repos/${activeRepo.owner}/${activeRepo.repo}`
      : env.dataDir;

    await gitAddAll(projectDir);
    await gitCommit(type, subject, body, projectDir);

    // Transition the active phase to complete and activate the next one
    const sessionId = getActiveSessionId();
    const db = getDatabase();
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

        const activePhase = phases.find((p) => p.status === 'active');
        if (activePhase) {
          await db
            .updateTable('phases')
            .set({ status: 'complete', completed_at: new Date().toISOString() } as never)
            .where('id', '=', activePhase.id)
            .execute();

          broadcast({
            type: 'phase:transition',
            data: { phaseNumber: activePhase.number, newStatus: 'complete' },
          } as never);

          // Activate the next phase
          const nextPhase = phases.find((p) => p.number === activePhase.number + 1);
          if (nextPhase) {
            await db
              .updateTable('phases')
              .set({ status: 'active', started_at: new Date().toISOString() } as never)
              .where('id', '=', nextPhase.id)
              .execute();

            broadcast({
              type: 'phase:transition',
              data: { phaseNumber: nextPhase.number, newStatus: 'active' },
            } as never);
          }
        }
      }
    }
  })().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Commit failed';
    // eslint-disable-next-line no-console
    console.error('[commit] Commit failed:', message);
    broadcast({
      type: 'commit:error',
      data: { error: message },
    } as never);
  });
}
