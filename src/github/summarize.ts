// Per-issue summarisation with Claude Haiku and Dreyfus-aware difficulty assessment.
// Results are cached by issue number + updated_at to avoid redundant API calls.

import { summaryCache } from './cache.js';
import { callApi } from '../api-client/claude.js';
import { issueSummarySchema, type IssueSummaryResponse } from '../api-client/schemas.js';

/** Minimal issue shape needed for summarisation. */
export interface SummarizableIssue {
  readonly number: number;
  readonly title: string;
  readonly body: string | null;
  readonly updated_at: string;
  readonly labels: ReadonlyArray<{ readonly name: string }>;
}

/**
 * Summarises a GitHub issue with Haiku and assigns a difficulty level
 * personalised to the developer's Dreyfus skill levels.
 *
 * Caching strategy:
 *   - Key: `issue:{number}:{updated_at}`
 *   - TTL: 1 hour (from summaryCache)
 *   - On cache hit, returns immediately without an API call
 *
 * @param issue - The GitHub issue to summarise
 * @param dreyfusContext - Human-readable Dreyfus skill summary (e.g. "TypeScript: Competent (confidence: 0.8)")
 * @param sessionId - Current session ID for API call logging
 * @returns Summary text and difficulty level
 */
export async function summarizeIssue(
  issue: SummarizableIssue,
  dreyfusContext: string,
  sessionId: number,
): Promise<IssueSummaryResponse> {
  const cacheKey = `issue:${String(issue.number)}:${issue.updated_at}`;

  // Check cache first
  const cached = await summaryCache.get(cacheKey);
  if (cached !== undefined) {
    return JSON.parse(cached) as IssueSummaryResponse;
  }

  // Build prompts
  const labelsText =
    issue.labels.length > 0
      ? `Labels: ${issue.labels.map((l) => l.name).join(', ')}`
      : 'No labels';

  const systemPrompt =
    'You summarise GitHub issues in 1-2 sentences and assess their difficulty ' +
    'relative to a developer with the following skill levels. ' +
    'Respond with JSON matching { "summary": string, "difficulty": "low"|"medium"|"high"|"very_high"|"extreme" }.\n\n' +
    `Developer skill levels: ${dreyfusContext}`;

  const bodySnippet = (issue.body ?? '').slice(0, 2000);
  const userMessage =
    `Issue #${String(issue.number)}: "${issue.title}"\n` +
    `${labelsText}\n\n` +
    `Body:\n${bodySnippet}`;

  const result = await callApi<IssueSummaryResponse>({
    callType: 'issue_summary',
    model: 'haiku',
    sessionId,
    systemPrompt,
    userMessage,
    responseSchema: issueSummarySchema,
    maxTokens: 256,
  });

  // Cache the result as a JSON string (summaryCache stores strings)
  await summaryCache.set(cacheKey, JSON.stringify(result));

  return result;
}
