import { z } from 'zod';

/** Schema for the three hint levels (low / medium / high) on each task. */
const HintsSchema = z.object({
  low: z.string().min(1),
  medium: z.string().min(1),
  high: z.string().min(1),
});

/** Schema for a single task within a phase. */
const TaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  target_files: z.array(z.string()).min(1),
  hints: HintsSchema,
});

/** Schema for a phase containing one or more tasks. */
const PhaseSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().min(1),
  hint: z.string().min(1),
  tasks: z.array(TaskSchema).min(1),
});

/** Full schema for the structured plan output from the planning agent. */
const AgentPlanOutputSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  relevant_files: z.array(z.string()),
  phases: z.array(PhaseSchema).min(1),
});

/** The validated plan shape produced by the planning agent. */
export type AgentPlanOutput = z.infer<typeof AgentPlanOutputSchema>;

/** Discriminated result type for parse operations. */
export type ParseResult =
  | { success: true; data: AgentPlanOutput }
  | { success: false; error: string };

/**
 * Parse and validate structured plan output from the planning agent.
 *
 * Handles three common formats:
 *   1. JSON wrapped in markdown code fences (```json ... ```)
 *   2. Raw JSON string
 *   3. JSON embedded in surrounding prose text
 *
 * Returns a discriminated union so callers can handle success/failure
 * without exceptions.
 */
export function parsePlanOutput(text: string): ParseResult {
  const json = extractJson(text);
  if (json === null) {
    return { success: false, error: 'No valid JSON found in agent output' };
  }

  const result = AgentPlanOutputSchema.safeParse(json);
  if (!result.success) {
    return { success: false, error: `Validation failed: ${result.error.message}` };
  }

  return { success: true, data: result.data };
}

/**
 * Attempt to extract a JSON value from text using three strategies
 * in priority order: code fences, raw JSON, then brace-delimited substring.
 */
function extractJson(text: string): unknown {
  // Strategy 1: Code-fenced JSON block
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch?.[1] !== undefined) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // fall through to next strategy
    }
  }

  // Strategy 2: Raw JSON (the entire input is valid JSON)
  try {
    return JSON.parse(text.trim());
  } catch {
    // fall through to next strategy
  }

  // Strategy 3: Find outermost braces in surrounding prose
  const braceStart = text.indexOf('{');
  const braceEnd = text.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      return JSON.parse(text.slice(braceStart, braceEnd + 1));
    } catch {
      return null;
    }
  }

  return null;
}
