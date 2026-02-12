// Zod schemas for all coaching agent structured outputs.
// Used with callApi() to validate Claude API responses at runtime.

import { z } from 'zod';

// ── Memory Retrieval Filter (Haiku) ─────────────────────────────────────────
// Filters raw ChromaDB results for relevance to the current coaching context.

export const memoryRetrievalFilterSchema = z.object({
  relevant_memories: z.array(
    z.object({
      content: z.string(),
      relevance: z.enum(['direct', 'related', 'contextual']),
      connection: z.string(),
      use_in_coaching: z.string(),
    }),
  ),
  discarded: z.array(
    z.object({
      content: z.string(),
      reason: z.string(),
    }),
  ),
});
export type MemoryRetrievalFilterResponse = z.infer<typeof memoryRetrievalFilterSchema>;

// ── Coach Agent (Sonnet) ────────────────────────────────────────────────────
// Transforms plan into phased coaching guidance with hints and difficulty.

export const coachAgentSchema = z.object({
  phases: z.array(
    z.object({
      number: z.number().int().positive(),
      title: z.string(),
      description: z.string(),
      expected_files: z.array(z.string()),
      hint_level: z.enum(['off', 'low', 'medium', 'high']),
      hints: z.object({
        file_hints: z.array(
          z.object({
            path: z.string(),
            style: z.enum(['suggested', 'warning', 'error']),
          }),
        ),
        line_hints: z.array(
          z.object({
            path: z.string(),
            start: z.number().int().positive(),
            end: z.number().int().positive(),
            style: z.enum(['suggested', 'warning', 'error']),
            hover_text: z.string(),
          }),
        ),
      }),
    }),
  ),
  memory_connection: z.string().nullable(),
  estimated_difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
});
export type CoachAgentResponse = z.infer<typeof coachAgentSchema>;

// ── Knowledge Gap Extraction (Sonnet) ───────────────────────────────────────
// Extracts knowledge gaps and generates kata specifications from session data.

export const knowledgeGapSchema = z.object({
  knowledge_gaps: z.array(
    z.object({
      topic: z.string(),
      evidence: z.string(),
      severity: z.enum(['low', 'medium', 'high']),
      related_concepts: z.array(z.string()),
    }),
  ),
  kata_specs: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      scaffolding_code: z.string(),
      instructor_notes: z.string(),
      constraints: z.array(z.string()),
    }),
  ),
});
export type KnowledgeGapResponse = z.infer<typeof knowledgeGapSchema>;

// ── Dreyfus Assessment (Sonnet) ─────────────────────────────────────────────
// Assesses developer skill levels using the Dreyfus model.

export const dreyfusAssessmentSchema = z.object({
  assessments: z.array(
    z.object({
      skill_area: z.string(),
      stage: z.enum(['Novice', 'Advanced Beginner', 'Competent', 'Proficient', 'Expert']),
      confidence: z.number().min(0).max(1),
      evidence: z.string(),
    }),
  ),
});
export type DreyfusAssessmentResponse = z.infer<typeof dreyfusAssessmentSchema>;

// ── Memory Summarisation (Haiku) ────────────────────────────────────────────
// Summarises session data into memories for ChromaDB storage.

export const memorySummarisationSchema = z.object({
  memories: z.array(
    z.object({
      content: z.string(),
      tags: z.array(z.string()),
      importance: z.enum(['low', 'medium', 'high']),
    }),
  ),
});
export type MemorySummarisationResponse = z.infer<typeof memorySummarisationSchema>;

// ── Observer Triage (Haiku) ──────────────────────────────────────────────
// Fast nudge/no-nudge binary decision for the Observer system.

export const triageSchema = z.object({
  should_nudge: z.boolean(),
  confidence: z.number().min(0).max(1),
  signal: z.string(),
  reasoning: z.string(),
});
export type TriageResponse = z.infer<typeof triageSchema>;

// ── Explain This (Sonnet) ───────────────────────────────────────────────
// Dreyfus-aware code explanation for selected code.

export const explainThisSchema = z.object({
  explanation: z.string(),
  phaseConnection: z.string().optional(),
});
export type ExplainThisResponse = z.infer<typeof explainThisSchema>;

// ── Practice Review (Sonnet) ────────────────────────────────────────────
// Kata solution review with level assignment and pass/fail.

export const practiceReviewSchema = z.object({
  review: z.string(),
  level: z.number().int().min(1).max(10),
  passed: z.boolean(),
});
export type PracticeReviewResponse = z.infer<typeof practiceReviewSchema>;

// ── Issue Suitability (Haiku) ──────────────────────────────────────────────
// Assesses GitHub issue suitability based on developer's Dreyfus skill levels.

export const issueSuitabilitySchema = z.object({
  assessments: z.array(
    z.object({
      issue_number: z.number().int(),
      suitability: z.enum(['excellent', 'good', 'fair', 'poor']),
      recommended_focus: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});
export type IssueSuitabilityResponse = z.infer<typeof issueSuitabilitySchema>;
