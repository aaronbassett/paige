// Unified Claude API client with structured outputs, logging, retry logic, and cost tracking.
// All backend features calling Claude use this module for consistent patterns and observability.

import type { ZodSchema } from 'zod';
import type { ModelTier } from './models.js';

/** Options for a Claude API call. */
export interface CallApiOptions<T> {
  callType: string;
  model: ModelTier;
  systemPrompt: string;
  userMessage: string;
  responseSchema: ZodSchema<T>;
  sessionId: number;
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

/**
 * Makes a Claude API call with structured output, automatic logging, and cost tracking.
 *
 * @param options - Call configuration including model, prompts, and schema
 * @returns Parsed, typed response matching the provided Zod schema
 * @throws ApiRefusalError if Claude refuses
 * @throws ApiMaxTokensError if response is truncated
 * @throws Error for transport/network failures after SDK retries
 */
export function callApi<T>(_options: CallApiOptions<T>): Promise<T> {
  return Promise.reject(new Error('Not implemented'));
}
