// Review result schema — defines the structured output format for the review agent.
// Validated with Zod to guarantee type safety at the parsing boundary.

import { z } from 'zod';

/** A single inline code comment attached to a file location. */
const codeCommentSchema = z.object({
  filePath: z.string(),
  startLine: z.number(),
  endLine: z.number(),
  comment: z.string(),
  severity: z.enum(['suggestion', 'issue', 'praise']),
});

/** Per-task feedback indicating completion status and coaching notes. */
const taskFeedbackSchema = z.object({
  taskTitle: z.string(),
  feedback: z.string(),
  taskComplete: z.boolean(),
});

/**
 * Structured review result returned by the review agent.
 *
 * - `overallFeedback`: High-level summary (encouraging but honest)
 * - `codeComments`: Inline comments anchored to file locations
 * - `taskFeedback`: Per-task completion assessment (optional, only when tasks are provided)
 * - `phaseComplete`: Whether the phase is considered done (optional)
 */
export const reviewResultSchema = z.object({
  overallFeedback: z.string(),
  codeComments: z.array(codeCommentSchema),
  taskFeedback: z.array(taskFeedbackSchema).optional(),
  phaseComplete: z.boolean().optional(),
});

export type ReviewResult = z.infer<typeof reviewResultSchema>;
export type CodeComment = z.infer<typeof codeCommentSchema>;
export type TaskFeedback = z.infer<typeof taskFeedbackSchema>;
