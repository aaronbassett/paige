import { sql, type Kysely } from 'kysely';
import type { ApiCallType, DatabaseTables } from '../types/domain.js';

// ── Pricing Table ──────────────────────────────────────────────────────────────

/** Per-token costs in USD. Used to estimate API call costs. */
export const MODEL_PRICING: Record<string, { inputPer1k: number; outputPer1k: number }> = {
  'claude-sonnet-4-5-20250929': { inputPer1k: 0.003, outputPer1k: 0.015 },
  'claude-haiku-4-5-20251001': { inputPer1k: 0.0008, outputPer1k: 0.004 },
  'claude-opus-4-6': { inputPer1k: 0.015, outputPer1k: 0.075 },
};

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ApiCallInput {
  sessionId: number;
  callType: ApiCallType;
  model: string;
  inputHash?: string;
  latencyMs: number; // -1 if failed
  inputTokens: number; // 0 if failed
  outputTokens: number; // 0 if failed
}

// ── Cost Calculation ───────────────────────────────────────────────────────────

/**
 * Calculates cost estimate in USD from token counts and model pricing.
 * Returns 0 if the model is not in the pricing table.
 */
function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model];
  if (pricing === undefined) {
    return 0;
  }
  return (inputTokens / 1000) * pricing.inputPer1k + (outputTokens / 1000) * pricing.outputPer1k;
}

// ── API Call Logging ───────────────────────────────────────────────────────────

/**
 * Inserts an API call log entry into the database with cost estimate.
 */
export async function logApiCall(db: Kysely<DatabaseTables>, entry: ApiCallInput): Promise<void> {
  const createdAt = new Date().toISOString();
  const costEstimate = calculateCost(entry.model, entry.inputTokens, entry.outputTokens);

  await db
    .insertInto('api_call_log')
    .values({
      session_id: entry.sessionId,
      call_type: entry.callType,
      model: entry.model,
      input_hash: entry.inputHash ?? null,
      latency_ms: entry.latencyMs,
      input_tokens: entry.inputTokens,
      output_tokens: entry.outputTokens,
      cost_estimate: costEstimate,
      created_at: createdAt,
    } as never)
    .execute();
}

// ── Period-Based Queries (Dashboard) ──────────────────────────────────────────

/**
 * Returns the total API call count within the given time period.
 * Period: 'today' = today, 'last_week' = last 7 days, 'last_month' = last 30 days, 'all_time' = no filter.
 */
export async function getApiCallCountByPeriod(
  db: Kysely<DatabaseTables>,
  period: string,
): Promise<number> {
  let query = db
    .selectFrom('api_call_log')
    .select([sql<number>`COALESCE(COUNT(*), 0)`.as('count')]);

  if (period !== 'all_time') {
    const interval =
      period === 'today' ? '-1 days' : period === 'last_week' ? '-7 days' : '-30 days';
    query = query.where('created_at', '>=', sql<string>`datetime('now', ${interval})`);
  }

  const result = await query.executeTakeFirstOrThrow();
  return Number(result.count);
}

/**
 * Returns the total estimated cost (USD) within the given time period.
 * Period: 'today' = today, 'last_week' = last 7 days, 'last_month' = last 30 days, 'all_time' = no filter.
 */
export async function getApiCostByPeriod(
  db: Kysely<DatabaseTables>,
  period: string,
): Promise<number> {
  let query = db
    .selectFrom('api_call_log')
    .select([sql<number>`COALESCE(SUM(cost_estimate), 0)`.as('totalCost')]);

  if (period !== 'all_time') {
    const interval =
      period === 'today' ? '-1 days' : period === 'last_week' ? '-7 days' : '-30 days';
    query = query.where('created_at', '>=', sql<string>`datetime('now', ${interval})`);
  }

  const result = await query.executeTakeFirstOrThrow();
  return Number(result.totalCost);
}

// ── Session Cost Query ─────────────────────────────────────────────────────────

/**
 * Returns the total estimated cost (USD) for all API calls in a session.
 * Returns 0 if there are no API calls for the session.
 */
export async function getSessionCost(
  db: Kysely<DatabaseTables>,
  sessionId: number,
): Promise<number> {
  const result = await db
    .selectFrom('api_call_log')
    .select((eb) => eb.fn.sum<number>('cost_estimate').as('total'))
    .where('session_id', '=', sessionId)
    .executeTakeFirst();

  return result?.total ?? 0;
}
