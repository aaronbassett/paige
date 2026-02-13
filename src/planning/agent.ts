/**
 * Planning agent — wraps the Claude Agent SDK to explore a codebase and
 * produce a phased implementation plan from a GitHub issue.
 *
 * Streams progress events (tool use descriptions, phase transitions) to
 * the caller via callbacks so the UI can render a live loading experience.
 */

import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { parsePlanOutput, type AgentPlanOutput } from './parser.js';
import { buildPlanningPrompt, PLANNING_SYSTEM_PROMPT, type IssueInput } from './prompts.js';

// ── Public types ────────────────────────────────────────────────────

/** A single progress event emitted while the agent works. */
export interface ProgressEvent {
  /** Human-readable description of what the agent is doing. */
  message: string;
  /** The tool being invoked, if applicable (e.g. "Read", "Glob", "Grep"). */
  toolName?: string;
  /** The file path being operated on, if applicable. */
  filePath?: string;
}

/** The four loading phases shown in the UI, with a 0-100 progress value. */
export type PlanningPhase = 'fetching' | 'exploring' | 'planning' | 'writing_hints';

/** Callbacks the caller provides to receive streaming updates. */
export interface PlanningCallbacks {
  onProgress: (event: ProgressEvent) => void;
  onPhaseUpdate: (phase: PlanningPhase, progress: number) => void;
  onComplete: (plan: AgentPlanOutput) => void;
  onError: (error: string) => void;
}

/** Input required to start a planning run. */
export interface PlanningAgentInput {
  issue: IssueInput;
  repoPath: string;
  callbacks: PlanningCallbacks;
}

// ── Tool description helpers ────────────────────────────────────────

type ToolDescriber = (input: Record<string, unknown>) => string;

const TOOL_DESCRIPTIONS: Record<string, ToolDescriber> = {
  Read: (input) => `Reading ${typeof input['file_path'] === 'string' ? input['file_path'] : 'file'}...`,
  Glob: (input) => `Searching for ${typeof input['pattern'] === 'string' ? input['pattern'] : 'files'}...`,
  Grep: (input) => `Searching for "${typeof input['pattern'] === 'string' ? input['pattern'] : 'pattern'}"...`,
  Bash: (input) => `Running command: ${typeof input['command'] === 'string' ? input['command'].slice(0, 60) : 'command'}...`,
};

function describeToolUse(name: string, input: Record<string, unknown>): ProgressEvent {
  const describer = TOOL_DESCRIPTIONS[name];
  const message = describer ? describer(input) : `Using ${name}...`;
  const filePath = typeof input['file_path'] === 'string' ? input['file_path'] : undefined;
  const event: ProgressEvent = { message, toolName: name };
  if (filePath !== undefined) {
    event.filePath = filePath;
  }
  return event;
}

// ── Content block type guard ────────────────────────────────────────

interface ToolUseBlock {
  type: 'tool_use';
  name: string;
  input: Record<string, unknown>;
}

function isToolUseBlock(block: unknown): block is ToolUseBlock {
  if (typeof block !== 'object' || block === null) return false;
  const obj = block as Record<string, unknown>;
  return (
    obj['type'] === 'tool_use' &&
    typeof obj['name'] === 'string' &&
    typeof obj['input'] === 'object' &&
    obj['input'] !== null
  );
}

// ── Main entry point ────────────────────────────────────────────────

/**
 * Run the planning agent to produce an implementation plan for a GitHub issue.
 *
 * The agent uses Claude's tools (Read, Glob, Grep) to explore the codebase,
 * then outputs a structured JSON plan. Progress is streamed to `callbacks`
 * so the UI can show real-time feedback.
 *
 * This function never throws — errors are routed through `callbacks.onError`.
 */
export async function runPlanningAgent({
  issue,
  repoPath,
  callbacks,
}: PlanningAgentInput): Promise<void> {
  callbacks.onPhaseUpdate('exploring', 0);

  let resultText = '';
  let resultErrors: string[] = [];
  let isErrorResult = false;
  let toolUseCount = 0;

  try {
    const stream = query({
      prompt: buildPlanningPrompt(issue),
      options: {
        tools: ['Read', 'Glob', 'Grep'],
        allowedTools: ['Read', 'Glob', 'Grep'],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        cwd: repoPath,
        systemPrompt: PLANNING_SYSTEM_PROMPT,
        model: 'claude-opus-4-6',
        maxTurns: 30,
        persistSession: false,
      },
    });

    for await (const message of stream as AsyncIterable<SDKMessage>) {
      processMessage(message, callbacks, {
        onToolUse: () => {
          toolUseCount++;
          updatePhaseFromToolCount(toolUseCount, callbacks);
        },
        onSuccessResult: (text) => {
          resultText = text;
        },
        onErrorResult: (errors) => {
          isErrorResult = true;
          resultErrors = errors;
        },
      });
    }
  } catch (err) {
    callbacks.onError(
      `Agent SDK error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return;
  }

  // Handle error result from the agent
  if (isErrorResult) {
    const errorMessage = resultErrors.length > 0 ? resultErrors.join('; ') : 'Agent execution failed';
    callbacks.onError(errorMessage);
    return;
  }

  if (!resultText) {
    callbacks.onError('Agent returned no result');
    return;
  }

  callbacks.onPhaseUpdate('writing_hints', 90);
  callbacks.onProgress({ message: 'Parsing implementation plan...' });

  const parseResult = parsePlanOutput(resultText);
  if (!parseResult.success) {
    callbacks.onError(parseResult.error);
    return;
  }

  callbacks.onPhaseUpdate('writing_hints', 100);
  callbacks.onComplete(parseResult.data);
}

// ── Internal message processing ─────────────────────────────────────

interface MessageHandlers {
  onToolUse: () => void;
  onSuccessResult: (text: string) => void;
  onErrorResult: (errors: string[]) => void;
}

function processMessage(
  message: SDKMessage,
  callbacks: PlanningCallbacks,
  handlers: MessageHandlers,
): void {
  // Track tool use for progress streaming
  if (message.type === 'assistant') {
    const content = message.message?.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (isToolUseBlock(block)) {
          handlers.onToolUse();
          const event = describeToolUse(block.name, block.input);
          callbacks.onProgress(event);
        }
      }
    }
  }

  // Capture the final result
  if (message.type === 'result') {
    if (message.subtype === 'success') {
      const resultText = 'result' in message && typeof message.result === 'string'
        ? message.result
        : '';
      handlers.onSuccessResult(resultText);
    } else {
      // Error result subtypes: error_during_execution, error_max_turns, etc.
      const errors = 'errors' in message && Array.isArray(message.errors)
        ? message.errors.filter((e): e is string => typeof e === 'string')
        : [];
      handlers.onErrorResult(errors);
    }
  }
}

/** Heuristic phase transitions based on how many tools the agent has used. */
function updatePhaseFromToolCount(
  count: number,
  callbacks: PlanningCallbacks,
): void {
  if (count === 1) {
    callbacks.onPhaseUpdate('exploring', 25);
  } else if (count === 5) {
    callbacks.onPhaseUpdate('exploring', 50);
  } else if (count === 10) {
    callbacks.onPhaseUpdate('planning', 75);
  }
}
