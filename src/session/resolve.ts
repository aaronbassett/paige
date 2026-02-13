// Server-managed session resolution with 15-minute inactivity timeout.
// Any request auto-resolves to an active session. Clients never provide session IDs.

import { join } from 'node:path';
import { getDatabase } from '../database/db.js';
import { createSession } from '../database/queries/sessions.js';
import {
  getActiveSessionId,
  setActiveSessionId,
  clearActiveSessionId,
  getActiveRepo,
} from '../mcp/session.js';
import { loadEnv } from '../config/env.js';

/** 15-minute timeout in milliseconds. */
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

export interface ResolvedSession {
  sessionId: number;
  isNew: boolean;
}

/**
 * Resolves the current active session, creating one if necessary.
 *
 * 1. If the in-memory singleton is set, query the DB to confirm it's still active
 *    and within the timeout window. If so, touch it and return.
 * 2. If the singleton is stale or unset, query for any active session within the window.
 * 3. If none found, expire all stale active sessions and create a new one.
 */
export async function resolveSession(): Promise<ResolvedSession> {
  const db = getDatabase();
  if (db === null) {
    throw new Error('Database not initialized');
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - SESSION_TIMEOUT_MS).toISOString();
  const nowIso = now.toISOString();

  // Try to find an active session within the timeout window
  const activeSession = await db
    .selectFrom('sessions')
    .selectAll()
    .where('status', '=', 'active')
    .where('last_activity_at', '>=', cutoff)
    .orderBy('last_activity_at', 'desc')
    .executeTakeFirst();

  if (activeSession) {
    // Touch the session and ensure the singleton is set
    await db
      .updateTable('sessions')
      .set({ last_activity_at: nowIso } as never)
      .where('id', '=', activeSession.id)
      .execute();

    setActiveSessionId(activeSession.id);

    return { sessionId: activeSession.id, isNew: false };
  }

  // No valid active session — expire all stale active sessions
  await db
    .updateTable('sessions')
    .set({ status: 'completed', ended_at: nowIso } as never)
    .where('status', '=', 'active')
    .execute();

  clearActiveSessionId();

  // Determine project_dir from active repo or env fallback
  const activeRepo = getActiveRepo();
  const env = loadEnv();
  const projectDir =
    activeRepo !== null
      ? join(env.dataDir, 'repos', activeRepo.owner, activeRepo.repo)
      : env.projectDir;

  // Create a new session
  const session = await createSession(db, {
    project_dir: projectDir,
    status: 'active',
    started_at: nowIso,
    last_activity_at: nowIso,
  });

  setActiveSessionId(session.id);

  // Stop old Observer and start new one if lifecycle helpers are available
  try {
    const { stopActiveObserver, startObserverForSession } =
      await import('../mcp/tools/lifecycle.js');
    stopActiveObserver();
    startObserverForSession(session.id);
  } catch {
    // lifecycle module may not be loaded yet during startup — that's fine
  }

  return { sessionId: session.id, isNew: true };
}

/**
 * Lightweight session touch for high-frequency messages (buffer:update, editor events).
 * Skips the full query if the singleton is already set; just updates last_activity_at.
 */
export async function touchSession(): Promise<void> {
  const sessionId = getActiveSessionId();
  if (sessionId === null) {
    // No active session — fall back to full resolve
    await resolveSession();
    return;
  }

  const db = getDatabase();
  if (db === null) return;

  await db
    .updateTable('sessions')
    .set({ last_activity_at: new Date().toISOString() } as never)
    .where('id', '=', sessionId)
    .execute();
}

/**
 * Expires all active sessions that have exceeded the timeout window.
 * Can be used for background cleanup.
 */
export async function expireStaleSessions(): Promise<number> {
  const db = getDatabase();
  if (db === null) return 0;

  const cutoff = new Date(Date.now() - SESSION_TIMEOUT_MS).toISOString();
  const nowIso = new Date().toISOString();

  const result = await db
    .updateTable('sessions')
    .set({ status: 'completed', ended_at: nowIso } as never)
    .where('status', '=', 'active')
    .where('last_activity_at', '<', cutoff)
    .executeTakeFirst();

  return Number(result.numUpdatedRows);
}
