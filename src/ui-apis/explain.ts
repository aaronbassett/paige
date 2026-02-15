// Explain This — Dreyfus-aware code explanation handler (T353)

import { callApi } from '../api-client/claude.js';
import { explainThisSchema } from '../api-client/schemas.js';
import { getDatabase } from '../database/db.js';
import { getAllDreyfus } from '../database/queries/dreyfus.js';
import { getPhasesByPlan } from '../database/queries/phases.js';
import { getPlansBySession } from '../database/queries/plans.js';
import { logAction } from '../logger/action-log.js';
import type { DreyfusAssessment } from '../types/domain.js';
import type { UserExplainData } from '../types/websocket.js';

/** Result of an Explain This request. */
export interface ExplainResult {
  explanation: string;
  phaseConnection: string | null;
}

/**
 * Builds a Dreyfus-aware system prompt based on the developer's assessed skill level.
 *
 * - Novice: uses simple language, high-level analogies, beginner-friendly framing
 * - Expert: focuses on architecture, trade-offs, and edge cases
 * - No assessments: generic explanation prompt
 */
function buildSystemPrompt(assessments: DreyfusAssessment[], phaseContext: string | null): string {
  let dreyfusSection: string;

  if (assessments.length === 0) {
    dreyfusSection =
      'Explain the selected code clearly and concisely. ' +
      'Assume the developer has some programming experience but may not be familiar with every concept.';
  } else {
    // Use the most recent assessment to determine the overall stage
    const stages = assessments.map((a) => a.stage);
    const hasNovice = stages.some((s) => s === 'Novice' || s === 'Advanced Beginner');
    const hasExpert = stages.some((s) => s === 'Expert' || s === 'Proficient');

    if (hasNovice && !hasExpert) {
      dreyfusSection =
        'The developer is at a novice level. Use high-level explanations with analogies ' +
        'and beginner-friendly language. Avoid jargon. Focus on what the code does, not how it does it internally.';
    } else if (hasExpert) {
      dreyfusSection =
        'The developer is at an expert level. Focus on architecture decisions, trade-offs, ' +
        'edge cases, and performance implications. Be concise and technical.';
    } else {
      dreyfusSection =
        'Explain the selected code clearly with moderate technical depth. ' +
        'The developer has intermediate experience.';
    }
  }

  let prompt =
    'You are Paige, an AI coaching assistant for developers. ' +
    'Your task is to explain selected code in a way that helps the developer learn.\n\n' +
    dreyfusSection;

  if (phaseContext !== null) {
    prompt +=
      '\n\nThe developer is currently working on a coaching phase. ' +
      'If the selected code relates to the current phase, explain the connection. ' +
      `Current phase context: ${phaseContext}`;
  }

  prompt +=
    '\n\nRespond with a JSON object containing:\n' +
    '- "explanation": A clear explanation of the selected code.\n' +
    '- "phaseConnection": (optional) How this code relates to the current coaching phase, or omit if not relevant.';

  return prompt;
}

/**
 * Handles a "user:explain" request: loads Dreyfus assessments, builds a
 * Dreyfus-aware system prompt, calls Sonnet, and returns the explanation.
 */
export async function handleExplainThis(
  data: UserExplainData,
  sessionId: number,
): Promise<ExplainResult> {
  const db = getDatabase();
  if (db === null) {
    throw new Error('Database not initialized. Cannot handle explain request.');
  }

  // Load Dreyfus assessments for prompt calibration
  const assessments = await getAllDreyfus(db);

  // Determine active phase context (if any)
  let phaseContext: string | null = null;
  const plans = await getPlansBySession(db, sessionId);
  const activePlan = plans.find((p) => p.is_active === 1);

  if (activePlan) {
    const phases = await getPhasesByPlan(db, activePlan.id);
    const activePhase = phases.find((p) => p.status === 'active');
    if (activePhase) {
      phaseContext = `Phase ${String(activePhase.number)}: ${activePhase.title} — ${activePhase.description}`;
    }
  }

  // Build Dreyfus-aware system prompt
  const systemPrompt = buildSystemPrompt(assessments, phaseContext);

  // Build user message with selected code and file path
  const userMessage =
    `Please explain the following code from ${data.path} ` +
    `(lines ${String(data.range.startLine)}-${String(data.range.endLine)}):\n\n` +
    `\`\`\`\n${data.text}\n\`\`\``;

  // Call Claude API
  const response = await callApi({
    callType: 'explain_this',
    model: 'sonnet',
    sessionId,
    systemPrompt,
    userMessage,
    responseSchema: explainThisSchema,
  });

  // Log the explain request action
  await logAction(db, sessionId, 'user_explain_request', {
    path: data.path,
  });

  return {
    explanation: response.explanation,
    phaseConnection: response.phaseConnection ?? null,
  };
}
