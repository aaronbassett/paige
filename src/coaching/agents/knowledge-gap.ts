// Knowledge Gap Agent — calls Sonnet to extract gaps and generate katas

import type { KnowledgeGapResponse } from '../../api-client/schemas.js';
import type { ActionLogEntry, Phase, KnowledgeGap } from '../../types/domain.js';

export interface KnowledgeGapAgentInput {
  sessionId: number;
  actionLog: ActionLogEntry[];
  phases: Phase[];
  existingGaps: KnowledgeGap[];
}

/** Calls Sonnet to extract knowledge gaps and generate kata specs. */
export function runKnowledgeGapAgent(
  _input: KnowledgeGapAgentInput,
): Promise<KnowledgeGapResponse> {
  return Promise.reject(new Error('Not implemented'));
}
