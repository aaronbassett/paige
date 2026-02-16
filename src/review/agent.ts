// Multi-turn review agent — uses Claude tool use to inspect code and produce structured feedback.
// Runs in a loop: the model calls tools (read_file, git_diff, list_files) until it has enough
// context to produce a final ReviewResult JSON response.

import Anthropic from '@anthropic-ai/sdk';
import { reviewTools, executeReviewTool } from './tools.js';
import { reviewResultSchema, type ReviewResult } from './schemas.js';

// ── Client ──────────────────────────────────────────────────────────────────

/** Lazily-initialized Anthropic client, reused across review calls. */
let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client === null) {
    client = new Anthropic();
  }
  return client;
}

/** Visible for testing: replace the client singleton. */
export function _setClient(c: Anthropic): void {
  client = c;
}

// ── Types ───────────────────────────────────────────────────────────────────

/** Progress event emitted during the review agent loop. */
export interface ReviewProgressEvent {
  message: string;
  toolName?: string | undefined;
  filePath?: string | undefined;
}

/** Input parameters for a review agent run. */
export interface ReviewRequest {
  /** What scope to review: a full phase, specific file(s), or a single task. */
  scope: 'phase' | 'current_file' | 'open_files' | 'current_task';
  /** Absolute path to the project root for tool execution. */
  projectDir: string;
  /** Title of the current phase (used for phase-scoped reviews). */
  phaseTitle?: string;
  /** Description of the current phase goal. */
  phaseDescription?: string;
  /** Tasks within the phase to evaluate individually. */
  tasks?: Array<{ title: string; description: string }>;
  /** Active file path (relative, for single-file reviews). */
  activeFilePath?: string;
  /** All open file paths (relative, for multi-file reviews). */
  openFilePaths?: string[];
  /** Optional callback invoked with progress events during the agent loop. */
  onProgress?: (event: ReviewProgressEvent) => void;
}

// ── Constants ───────────────────────────────────────────────────────────────

const MAX_TURNS = 20;
const MAX_TOKENS = 8192;
const MODEL = 'claude-sonnet-4-5-20250929';

const SYSTEM_PROMPT = `You are a coaching-oriented code reviewer for junior developers. Your job is to help them learn, not just find bugs.

Review the code changes and provide:
1. Overall feedback (encouraging but honest)
2. Specific code comments with file paths and line numbers
3. Task-by-task feedback if tasks are provided
4. Whether the phase/task is complete

Be specific. Reference actual code. Explain WHY something matters, not just what to change.
Use severity levels: 'praise' for good work, 'suggestion' for improvements, 'issue' for problems.

IMPORTANT: Be efficient with tool calls. Start with git_diff to see what changed, then read only the files that were modified. Do NOT exhaustively explore the codebase. Once you have enough context (usually after 3-5 tool calls), stop calling tools and produce your final JSON result.

When you are ready, output ONLY a JSON object (no tool calls) matching this schema:
{
  "overallFeedback": "string",
  "codeComments": [{ "filePath": "string", "startLine": number, "endLine": number, "comment": "string", "severity": "suggestion" | "issue" | "praise" }],
  "taskFeedback": [{ "taskTitle": "string", "feedback": "string", "taskComplete": boolean }],
  "phaseComplete": boolean
}`;

// ── Agent Loop ──────────────────────────────────────────────────────────────

/**
 * Run the multi-turn review agent.
 *
 * The agent uses tool calls to read files and check git diffs, then produces
 * a structured ReviewResult. It loops up to MAX_TURNS times, executing tool
 * calls and feeding results back into the conversation, until the model
 * produces a final text response with the JSON review.
 *
 * @param request - Review scope, project directory, and optional context
 * @returns Parsed ReviewResult validated against the Zod schema
 * @throws Error if the agent exceeds MAX_TURNS or produces unparseable output
 */
export async function runReviewAgent(request: ReviewRequest): Promise<ReviewResult> {
  const anthropic = getClient();
  const userPrompt = buildUserPrompt(request);
  const { onProgress } = request;

  onProgress?.({ message: 'Starting review...' });

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools: reviewTools,
      messages,
    });

    // Collect tool use blocks from the response
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );

    // If there are tool uses, execute them and continue the loop
    if (toolUseBlocks.length > 0) {
      // Add the full assistant message (may contain both text and tool_use blocks)
      messages.push({ role: 'assistant', content: response.content });

      // Execute each tool and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        const input = toolUse.input as Record<string, unknown>;
        const filePath = (input['path'] as string | undefined) ?? undefined;
        const toolLabel =
          toolUse.name === 'read_file'
            ? `Reading ${filePath ?? 'file'}`
            : toolUse.name === 'git_diff'
              ? filePath
                ? `Checking diff for ${filePath}`
                : 'Checking git diff'
              : toolUse.name === 'list_files'
                ? `Listing files in ${filePath ?? '.'}`
                : `Running ${toolUse.name}`;
        onProgress?.({ message: toolLabel, toolName: toolUse.name, filePath });

        const result = await executeReviewTool(toolUse.name, input, request.projectDir);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      // Feed tool results back as a user message.
      // If nearing the turn limit, nudge the model to wrap up.
      const userContent: Anthropic.ContentBlockParam[] = [...toolResults];
      if (turn >= MAX_TURNS - 2) {
        userContent.push({
          type: 'text',
          text: 'You are running low on turns. Please stop calling tools and produce your final JSON review result now.',
        });
      }
      messages.push({ role: 'user', content: userContent });
      continue;
    }

    // No tool use — this is the final response. Extract text and parse JSON.
    onProgress?.({ message: 'Generating review feedback...' });

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    );

    if (textBlock) {
      // Extract JSON from the response text (may be wrapped in markdown fences)
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed: unknown = JSON.parse(jsonMatch[0]);
        return reviewResultSchema.parse(parsed);
      }
    }

    // Fallback: return a minimal result with whatever text was produced
    return {
      overallFeedback: textBlock?.text ?? 'Review completed but no structured output was produced.',
      codeComments: [],
    };
  }

  throw new Error('Review agent exceeded maximum turns');
}

// ── Prompt Builder ──────────────────────────────────────────────────────────

/** Build the user prompt from the review request context. */
function buildUserPrompt(request: ReviewRequest): string {
  const parts: string[] = [];

  switch (request.scope) {
    case 'phase':
      parts.push(`Review scope: entire phase "${request.phaseTitle ?? 'current'}"`);
      if (request.phaseDescription) {
        parts.push(`Phase goal: ${request.phaseDescription}`);
      }
      break;

    case 'current_file':
      if (request.activeFilePath) {
        parts.push(`Review scope: single file "${request.activeFilePath}"`);
      }
      break;

    case 'open_files':
      if (request.openFilePaths) {
        parts.push(`Review scope: open files: ${request.openFilePaths.join(', ')}`);
      }
      break;

    case 'current_task':
      parts.push('Review scope: current task');
      break;
  }

  if (request.tasks && request.tasks.length > 0) {
    parts.push('\nTasks to evaluate:');
    for (const task of request.tasks) {
      parts.push(`- ${task.title}: ${task.description}`);
    }
  }

  parts.push(
    '\nPlease use the available tools to read files and check git diffs, then provide your review.',
  );

  return parts.join('\n');
}
