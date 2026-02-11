import { sql } from 'kysely';
import type { AppDatabase } from '../db.js';
import type { ActionLogEntry, ActionType, ApiCallLogEntry } from '../../types/domain.js';

// ── Action Log Queries ─────────────────────────────────────────────────────

/**
 * Retrieves all action log entries for a given session, ordered by created_at ASC.
 */
export async function getActionsBySession(
  db: AppDatabase,
  sessionId: number,
): Promise<ActionLogEntry[]> {
  return db
    .selectFrom('action_log')
    .selectAll()
    .where('session_id', '=', sessionId)
    .orderBy('created_at', 'asc')
    .execute() as Promise<ActionLogEntry[]>;
}

/**
 * Retrieves action log entries for a session filtered by action type.
 */
export async function getActionsByType(
  db: AppDatabase,
  sessionId: number,
  actionType: ActionType,
): Promise<ActionLogEntry[]> {
  return db
    .selectFrom('action_log')
    .selectAll()
    .where('session_id', '=', sessionId)
    .where('action_type', '=', actionType)
    .orderBy('created_at', 'asc')
    .execute() as Promise<ActionLogEntry[]>;
}

/**
 * Retrieves the most recent N actions for a session, ordered by created_at DESC.
 */
export async function getRecentActions(
  db: AppDatabase,
  sessionId: number,
  limit: number,
): Promise<ActionLogEntry[]> {
  return db
    .selectFrom('action_log')
    .selectAll()
    .where('session_id', '=', sessionId)
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .limit(limit)
    .execute() as Promise<ActionLogEntry[]>;
}

// ── API Call Log Queries ───────────────────────────────────────────────────

/**
 * Retrieves all API call log entries for a given session, ordered by created_at ASC.
 */
export async function getApiCallsBySession(
  db: AppDatabase,
  sessionId: number,
): Promise<ApiCallLogEntry[]> {
  return db
    .selectFrom('api_call_log')
    .selectAll()
    .where('session_id', '=', sessionId)
    .orderBy('created_at', 'asc')
    .execute() as Promise<ApiCallLogEntry[]>;
}

/** Aggregated stats for API calls within a session. */
export interface ApiCallStats {
  totalCost: number;
  avgLatencyMs: number;
  callCount: number;
}

/**
 * Returns aggregated cost, latency, and call count for all API calls in a session.
 *
 * Returns zeroed stats when no API calls exist for the given session.
 */
/**
 * Returns the count of distinct sessions within the given time period.
 * Period: '7d' = last 7 days, '30d' = last 30 days, 'all' = no filter.
 */
export async function getSessionCountByPeriod(db: AppDatabase, period: string): Promise<number> {
  let query = db.selectFrom('sessions').select([sql<number>`COALESCE(COUNT(*), 0)`.as('count')]);

  if (period !== 'all') {
    const interval = period === '7d' ? '-7 days' : '-30 days';
    query = query.where('started_at', '>=', sql<string>`datetime('now', ${interval})`);
  }

  const result = await query.executeTakeFirstOrThrow();
  return Number(result.count);
}

/**
 * Returns the total action count within the given time period.
 * Period: '7d' = last 7 days, '30d' = last 30 days, 'all' = no filter.
 */
export async function getActionCountByPeriod(db: AppDatabase, period: string): Promise<number> {
  let query = db.selectFrom('action_log').select([sql<number>`COALESCE(COUNT(*), 0)`.as('count')]);

  if (period !== 'all') {
    const interval = period === '7d' ? '-7 days' : '-30 days';
    query = query.where('created_at', '>=', sql<string>`datetime('now', ${interval})`);
  }

  const result = await query.executeTakeFirstOrThrow();
  return Number(result.count);
}

/**
 * Returns aggregated cost, latency, and call count for all API calls in a session.
 *
 * Returns zeroed stats when no API calls exist for the given session.
 */
export async function getApiCallStats(db: AppDatabase, sessionId: number): Promise<ApiCallStats> {
  const result = await db
    .selectFrom('api_call_log')
    .select([
      sql<number>`COALESCE(SUM(cost_estimate), 0)`.as('totalCost'),
      sql<number>`COALESCE(AVG(latency_ms), 0)`.as('avgLatencyMs'),
      sql<number>`COUNT(*)`.as('callCount'),
    ])
    .where('session_id', '=', sessionId)
    .executeTakeFirstOrThrow();

  return {
    totalCost: Number(result.totalCost),
    avgLatencyMs: Number(result.avgLatencyMs),
    callCount: Number(result.callCount),
  };
}
