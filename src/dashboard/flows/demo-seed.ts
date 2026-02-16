// Shared utility for demo data seeding.
// Returns a valid session ID for inserting demo rows when no real sessions exist.

import type { AppDatabase } from '../../database/db.js';
import { getActiveSessionId } from '../../mcp/session.js';
import { createSession } from '../../database/queries/sessions.js';

/**
 * Returns a session ID suitable for demo data insertion.
 *
 * Resolution order:
 *  1. Active session (set by MCP start_session tool)
 *  2. Any existing session in the database
 *  3. Creates a minimal demo session as a last resort
 */
export async function getOrCreateDemoSessionId(db: AppDatabase): Promise<number> {
  const activeId = getActiveSessionId();
  if (activeId !== null) return activeId;

  const existing = await db
    .selectFrom('sessions')
    .select('id')
    .orderBy('id', 'desc')
    .executeTakeFirst();

  if (existing) return Number(existing.id);

  const session = await createSession(db, {
    project_dir: '/demo',
    status: 'active',
    started_at: new Date().toISOString(),
  });

  return session.id;
}
