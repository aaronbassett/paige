// Materials Agent — calls Sonnet to generate curated learning resources for knowledge gaps

import { callApi } from '../../api-client/claude.js';
import {
  learningMaterialGenerationSchema,
  type LearningMaterialGenerationResponse,
} from '../../api-client/schemas.js';

export interface MaterialsAgentInput {
  phaseTitle: string;
  phaseDescription: string;
  knowledgeGaps: Array<{ topic: string; description: string }>;
  issueTitle: string;
  sessionId: number;
}

const MATERIALS_SYSTEM_PROMPT = `You are a learning resource curator for junior developers. Given a coding task and identified knowledge gaps, recommend 2-3 high-quality learning resources.

Rules:
- Mix YouTube videos and articles (at least one of each when possible)
- Prefer well-known sources: MDN Web Docs, official documentation, Fireship, Traversy Media, ThePrimeagen, freeCodeCamp, web.dev, CSS-Tricks
- YouTube URLs must be real, well-known videos from established channels. Use the format https://www.youtube.com/watch?v=VIDEO_ID
- Article URLs must be from established documentation sites or blogs
- Each description should be 1-2 sentences explaining why this resource is relevant
- Each question should test whether the developer actually engaged with the material — not trivial recall, but understanding of a key concept covered in the resource
- Questions should be answerable in 2-3 sentences`;

/** Calls Sonnet Materials Agent to produce curated learning resources for a phase. */
export function runMaterialsAgent(
  input: MaterialsAgentInput,
): Promise<LearningMaterialGenerationResponse> {
  const userMessage = JSON.stringify({
    task: input.issueTitle,
    phase: { title: input.phaseTitle, description: input.phaseDescription },
    knowledge_gaps: input.knowledgeGaps,
  });

  return callApi<LearningMaterialGenerationResponse>({
    callType: 'materials_generation',
    model: 'sonnet',
    systemPrompt: MATERIALS_SYSTEM_PROMPT,
    userMessage,
    responseSchema: learningMaterialGenerationSchema,
    sessionId: input.sessionId,
    maxTokens: 2048,
  });
}
