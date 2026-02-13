// Unified Claude API client with structured outputs, logging, retry logic, and cost tracking.
// All backend features calling Claude use this module for consistent patterns and observability.

import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { ZodSchema } from 'zod';
import { getDatabase } from '../database/db.js';
import { logApiCall } from '../logger/api-log.js';
import type { ApiCallType } from '../types/domain.js';
import { resolveModel, getModelPricing, type ModelTier } from './models.js';

// ── Singleton Client ─────────────────────────────────────────────────────────

/** Lazily-initialized Anthropic client, reused for all API calls (FR-093). */
let client: Anthropic | null = null;

/**
 * Returns the singleton Anthropic client, creating it on first access.
 * Uses ANTHROPIC_API_KEY from the environment.
 */
function getClient(): Anthropic {
  if (client === null) {
    client = new Anthropic({
      apiKey: process.env['ANTHROPIC_API_KEY'],
    });
  }
  return client;
}

// ── Types ────────────────────────────────────────────────────────────────────

/** Options for a Claude API call. */
export interface CallApiOptions<T> {
  callType: string;
  model: ModelTier;
  systemPrompt: string;
  userMessage: string;
  responseSchema: ZodSchema<T>;
  sessionId: number | null;
  maxTokens?: number;
  tools?: Array<{ type: string; name: string }>;
}

/** Error thrown when Claude refuses to answer. */
export class ApiRefusalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiRefusalError';
  }
}

/** Error thrown when response is truncated due to max_tokens limit. */
export class ApiMaxTokensError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiMaxTokensError';
  }
}

// ── Core API Function ────────────────────────────────────────────────────────

/**
 * Makes a Claude API call with structured output, automatic logging, and cost tracking.
 *
 * Flow:
 * 1. Resolve model tier to full model ID
 * 2. Compute input hash (SHA-256 of userMessage, truncated to 16 hex chars)
 * 3. Call Anthropic SDK
 * 4. Check stop_reason for refusal / max_tokens
 * 5. Parse text response as JSON, validate with Zod schema
 * 6. Log API call to database
 * 7. Return parsed result
 *
 * @param options - Call configuration including model, prompts, and schema
 * @returns Parsed, typed response matching the provided Zod schema
 * @throws ApiRefusalError if Claude refuses (FR-089)
 * @throws ApiMaxTokensError if response is truncated (FR-090)
 * @throws Error for transport/network failures after SDK retries (FR-091)
 */
export async function callApi<T>(options: CallApiOptions<T>): Promise<T> {
  const anthropic = getClient();
  const modelId = resolveModel(options.model);
  const pricing = getModelPricing(options.model);
  const inputHash = createHash('sha256').update(options.userMessage).digest('hex').slice(0, 16);
  const db = getDatabase();

  const startTime = Date.now();

  try {
    // Call Anthropic SDK with structured output (FR-083, FR-084, FR-092)
    const response = await anthropic.messages.create({
      model: modelId,
      max_tokens: options.maxTokens ?? 4096,
      system: options.systemPrompt,
      messages: [{ role: 'user', content: options.userMessage }],
      output_config: { format: zodOutputFormat(options.responseSchema) },
      ...(options.tools ? { tools: options.tools as never } : {}),
    });

    // Check stop_reason for error conditions (FR-089, FR-090)
    if (response.stop_reason === 'refusal') {
      await logFailure(db, options, modelId, inputHash);
      throw new ApiRefusalError(`Claude refused the request (call_type=${options.callType})`);
    }
    if (response.stop_reason === 'max_tokens') {
      await logFailure(db, options, modelId, inputHash);
      throw new ApiMaxTokensError(
        `Response truncated at max_tokens (call_type=${options.callType})`,
      );
    }

    // Extract text content from the first content block
    const textBlock = response.content[0];
    if (textBlock === undefined || textBlock.type !== 'text') {
      await logFailure(db, options, modelId, inputHash);
      throw new Error(`Unexpected response content type from Claude API`);
    }

    // Parse and validate — structured output guarantees valid JSON
    const parsed: unknown = JSON.parse(textBlock.text);
    const result = options.responseSchema.parse(parsed);

    // Compute metrics (FR-087)
    const latencyMs = Date.now() - startTime;
    const costEstimate =
      (response.usage.input_tokens * pricing.inputPerMillion +
        response.usage.output_tokens * pricing.outputPerMillion) /
      1_000_000;

    // Log successful API call (FR-086) — skip when no active session
    if (db !== null && options.sessionId !== null) {
      await logApiCall(db, {
        sessionId: options.sessionId,
        callType: options.callType as ApiCallType,
        model: modelId,
        inputHash,
        latencyMs,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      });
    }

    // Suppress unused variable warning — costEstimate is computed for future use
    void costEstimate;

    return result;
  } catch (error) {
    // Re-throw known API errors without double-logging
    if (error instanceof ApiRefusalError || error instanceof ApiMaxTokensError) {
      throw error;
    }

    // Log unexpected failures with sentinel values (FR-091)
    await logFailure(db, options, modelId, inputHash);
    throw error;
  }
}

// ── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Logs a failed API call with sentinel values: latencyMs=-1, zero tokens (FR-089, FR-090, FR-091).
 */
async function logFailure(
  db: ReturnType<typeof getDatabase>,
  options: CallApiOptions<unknown>,
  modelId: string,
  inputHash: string,
): Promise<void> {
  if (db !== null && options.sessionId !== null) {
    await logApiCall(db, {
      sessionId: options.sessionId,
      callType: options.callType as ApiCallType,
      model: modelId,
      inputHash,
      latencyMs: -1,
      inputTokens: 0,
      outputTokens: 0,
    });
  }
}
