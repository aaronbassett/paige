// Dreyfus Agent — calls Sonnet to assess skill levels using the Dreyfus model

import { callApi } from '../../api-client/claude.js';
import {
  dreyfusAssessmentSchema,
  type DreyfusAssessmentResponse,
} from '../../api-client/schemas.js';
import type { DreyfusAssessment } from '../../types/domain.js';

export interface DreyfusAgentInput {
  sessionId: number;
  currentAssessments: DreyfusAssessment[];
  phasesCompleted: number;
  hintsUsed: number;
  independentCompletions: number;
}

const SYSTEM_PROMPT = `You are Paige's skill assessor. Evaluate the user's competency across skill areas using the Dreyfus model (Novice, Advanced Beginner, Competent, Proficient, Expert). Base assessments on accumulated evidence across sessions, not just the latest session. Respond with valid JSON matching the required schema.`;

/** Calls Sonnet to assess Dreyfus skill levels. */
export function runDreyfusAgent(input: DreyfusAgentInput): Promise<DreyfusAssessmentResponse> {
  const userMessage = JSON.stringify({
    current_assessments: input.currentAssessments.map((a) => ({
      skill_area: a.skill_area,
      stage: a.stage,
      confidence: a.confidence,
    })),
    recent_session: {
      phases_completed: input.phasesCompleted,
      hints_used: input.hintsUsed,
      independent_completions: input.independentCompletions,
    },
  });

  return callApi<DreyfusAssessmentResponse>({
    callType: 'dreyfus_agent',
    model: 'sonnet',
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    responseSchema: dreyfusAssessmentSchema,
    sessionId: input.sessionId,
    maxTokens: 2048,
  });
}
