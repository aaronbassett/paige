// Reflection Agent — calls Haiku to summarise session into memories

import { callApi } from '../../api-client/claude.js';
import {
  memorySummarisationSchema,
  type MemorySummarisationResponse,
} from '../../api-client/schemas.js';

export interface ReflectionAgentInput {
  sessionId: number;
  sessionTranscript: string;
  issueTitle: string;
  phasesCompleted: Array<{ title: string; description: string }>;
  knowledgeGaps: Array<{ topic: string; severity: string }>;
}

const SYSTEM_PROMPT = [
  "You are Paige's memory curator.",
  'Summarise a coding coaching session into concise, searchable memories for future retrieval.',
  'Each memory should capture one meaningful insight — what was worked on, what was learned, what was struggled with, or what the user demonstrated competence in.',
  'Tag memories for semantic search.',
  'Only persist what would be useful in a future coaching session.',
  'Respond with valid JSON matching the required schema.',
].join(' ');

/** Calls Haiku to produce memory summaries from session data. */
export function runReflectionAgent(
  input: ReflectionAgentInput,
): Promise<MemorySummarisationResponse> {
  const userMessage = JSON.stringify({
    session_transcript: input.sessionTranscript,
    issue_title: input.issueTitle,
    phases_completed: input.phasesCompleted,
    knowledge_gaps: input.knowledgeGaps,
  });

  return callApi<MemorySummarisationResponse>({
    callType: 'reflection_agent',
    model: 'haiku',
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    responseSchema: memorySummarisationSchema,
    sessionId: input.sessionId,
    maxTokens: 2048,
  });
}
