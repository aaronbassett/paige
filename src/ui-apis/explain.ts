// Explain This — Dreyfus-aware code explanation handler (T353)

import type { UserExplainData } from '../types/websocket.js';

/** Result of an Explain This request. */
export interface ExplainResult {
  explanation: string;
  phaseConnection: string | null;
}

/**
 * Handles a "user:explain" request: loads Dreyfus assessments, builds a
 * Dreyfus-aware system prompt, calls Sonnet, and returns the explanation.
 */
export function handleExplainThis(
  _data: UserExplainData,
  _sessionId: number,
): Promise<ExplainResult> {
  return Promise.reject(new Error('Not implemented'));
}
