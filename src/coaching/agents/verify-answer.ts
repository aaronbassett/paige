// Verify Answer Agent — calls Haiku to evaluate whether a developer's answer
// demonstrates genuine understanding of a learning resource.

import { callApi } from '../../api-client/claude.js';
import {
  answerVerificationSchema,
  type AnswerVerificationResponse,
} from '../../api-client/schemas.js';

export interface VerifyAnswerInput {
  materialTitle: string;
  materialUrl: string;
  materialType: 'youtube' | 'article';
  question: string;
  answer: string;
  sessionId: number;
}

const VERIFY_SYSTEM_PROMPT = `You are evaluating whether a junior developer understood a learning resource. Be encouraging but honest.

Rules:
- The answer doesn't need to be perfect — it should show genuine engagement with the material
- Accept answers that demonstrate understanding of the core concept, even with imperfect wording
- Err on the side of accepting — this is coaching, not an exam
- If incorrect, provide brief encouraging feedback suggesting what to focus on when revisiting the material
- feedback should be 1-2 sentences max`;

/** Calls Haiku to verify whether a developer's answer demonstrates understanding. */
export function verifyAnswer(input: VerifyAnswerInput): Promise<AnswerVerificationResponse> {
  const userMessage = JSON.stringify({
    material: {
      title: input.materialTitle,
      url: input.materialUrl,
      type: input.materialType,
    },
    question: input.question,
    developer_answer: input.answer,
  });

  return callApi<AnswerVerificationResponse>({
    callType: 'answer_verification',
    model: 'haiku',
    systemPrompt: VERIFY_SYSTEM_PROMPT,
    userMessage,
    responseSchema: answerVerificationSchema,
    sessionId: input.sessionId,
    maxTokens: 512,
  });
}
