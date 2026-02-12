// Knowledge Gap Agent — calls Sonnet to extract gaps and generate katas

import { callApi } from '../../api-client/claude.js';
import { knowledgeGapSchema, type KnowledgeGapResponse } from '../../api-client/schemas.js';
import type { ActionLogEntry, Phase, KnowledgeGap } from '../../types/domain.js';

export interface KnowledgeGapAgentInput {
  sessionId: number;
  actionLog: ActionLogEntry[];
  phases: Phase[];
  existingGaps: KnowledgeGap[];
}

const SYSTEM_PROMPT = `You are Paige's learning analyst. Analyse a coding coaching session to identify knowledge gaps — topics where the user struggled, needed excessive hints, or made repeated mistakes. Generate practice kata specifications targeting those gaps. Be evidence-based: cite observable session data, not assumptions. Respond with valid JSON matching the required schema.`;

/** Calls Sonnet to extract knowledge gaps and generate kata specs. */
export function runKnowledgeGapAgent(input: KnowledgeGapAgentInput): Promise<KnowledgeGapResponse> {
  const userMessage = JSON.stringify({
    action_log: input.actionLog.map((entry) => ({
      action_type: entry.action_type,
      data: entry.data !== null ? (JSON.parse(entry.data) as unknown) : null,
      created_at: entry.created_at,
    })),
    phases: input.phases.map((phase) => ({
      title: phase.title,
      status: phase.status,
      hint_level: phase.hint_level,
    })),
    existing_gaps: input.existingGaps.map((gap) => ({
      topic: gap.topic,
      severity: gap.severity,
    })),
  });

  return callApi<KnowledgeGapResponse>({
    callType: 'knowledge_gap_agent',
    model: 'sonnet',
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    responseSchema: knowledgeGapSchema,
    sessionId: input.sessionId,
    maxTokens: 4096,
  });
}
