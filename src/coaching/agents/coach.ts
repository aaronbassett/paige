// Coach Agent — calls Sonnet to transform plan into phased coaching guidance

import type { DreyfusAssessment } from '../../types/domain.js';
import type {
  CoachAgentResponse,
  MemoryRetrievalFilterResponse,
} from '../../api-client/schemas.js';

export interface CoachAgentInput {
  planText: string;
  issueSummary: string;
  sessionId: number;
  dreyfusAssessments: DreyfusAssessment[];
  relevantMemories: MemoryRetrievalFilterResponse['relevant_memories'];
}

/** Calls Sonnet Coach Agent to produce phased coaching plan. */
export function runCoachAgent(_input: CoachAgentInput): Promise<CoachAgentResponse> {
  return Promise.reject(new Error('Not implemented'));
}
