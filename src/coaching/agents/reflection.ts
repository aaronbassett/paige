// Reflection Agent — calls Haiku to summarise session into memories

import type { MemorySummarisationResponse } from '../../api-client/schemas.js';

export interface ReflectionAgentInput {
  sessionId: number;
  sessionTranscript: string;
  issueTitle: string;
  phasesCompleted: Array<{ title: string; description: string }>;
  knowledgeGaps: Array<{ topic: string; severity: string }>;
}

/** Calls Haiku to produce memory summaries from session data. */
export function runReflectionAgent(
  _input: ReflectionAgentInput,
): Promise<MemorySummarisationResponse> {
  return Promise.reject(new Error('Not implemented'));
}
