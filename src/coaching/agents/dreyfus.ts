// Dreyfus Agent — calls Sonnet to assess skill levels

import type { DreyfusAssessmentResponse } from '../../api-client/schemas.js';
import type { DreyfusAssessment } from '../../types/domain.js';

export interface DreyfusAgentInput {
  sessionId: number;
  currentAssessments: DreyfusAssessment[];
  phasesCompleted: number;
  hintsUsed: number;
  independentCompletions: number;
}

/** Calls Sonnet to assess Dreyfus skill levels. */
export function runDreyfusAgent(_input: DreyfusAgentInput): Promise<DreyfusAssessmentResponse> {
  return Promise.reject(new Error('Not implemented'));
}
