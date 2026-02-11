// Coach Agent — calls Sonnet to transform plan into phased coaching guidance

import { callApi } from '../../api-client/claude.js';
import {
  coachAgentSchema,
  type CoachAgentResponse,
  type MemoryRetrievalFilterResponse,
} from '../../api-client/schemas.js';
import type { DreyfusAssessment } from '../../types/domain.js';

export interface CoachAgentInput {
  planText: string;
  issueSummary: string;
  sessionId: number;
  dreyfusAssessments: DreyfusAssessment[];
  relevantMemories: MemoryRetrievalFilterResponse['relevant_memories'];
}

const COACH_SYSTEM_PROMPT = `You are Paige's coaching engine — the pedagogical core of an AI coding coach.
You transform implementation plans into scaffolded, phased learning experiences.
Adapt guidance granularity to the user's Dreyfus stage: novices need specific line-level hints;
competent developers need directional guidance. Reference relevant memories to build continuity.
Respond with valid JSON matching the required schema.`;

/** Calls Sonnet Coach Agent to produce phased coaching plan. */
export function runCoachAgent(input: CoachAgentInput): Promise<CoachAgentResponse> {
  const userMessage = JSON.stringify({
    plan: input.planText,
    dreyfus_assessments: input.dreyfusAssessments.map((a) => ({
      skill_area: a.skill_area,
      stage: a.stage,
      confidence: a.confidence,
    })),
    relevant_memories: (input.relevantMemories ?? []).map((m) => ({
      content: m.content,
      connection: m.connection,
      use_in_coaching: m.use_in_coaching,
    })),
  });

  return callApi<CoachAgentResponse>({
    callType: 'coach_agent',
    model: 'sonnet',
    systemPrompt: COACH_SYSTEM_PROMPT,
    userMessage,
    responseSchema: coachAgentSchema,
    sessionId: input.sessionId,
    maxTokens: 4096,
  });
}
