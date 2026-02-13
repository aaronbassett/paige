/**
 * Nudge agent — uses Claude Haiku to generate brief coaching nudges
 * for the Observer system when a developer appears stuck.
 *
 * Lightweight by design: uses the smallest capable model, allows only
 * the Read tool, and limits to 2 turns. Returns null on any failure
 * so the Observer can silently skip nudges without disrupting the session.
 */

import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';

// ── Public types ────────────────────────────────────────────────────

/** Input context the Observer provides to generate a nudge. */
export interface NudgeInput {
  /** Free-text description of what the developer has been doing. */
  sessionContext: string;
  /** The current phase title from the implementation plan. */
  currentPhase: string;
  /** The file currently open in the editor, if any. */
  currentFile: string | null;
  /** Absolute path to the repository root. */
  repoPath: string;
}

// ── System prompt ───────────────────────────────────────────────────

const NUDGE_SYSTEM_PROMPT = `You are a supportive coding coach helping a junior developer. Based on the context provided, generate a brief, encouraging nudge message (1-3 sentences) to help them move forward. Be specific to their current task. Never give away the answer — guide, don't solve.`;

// ── Main entry point ────────────────────────────────────────────────

/**
 * Generate a coaching nudge message based on session context.
 *
 * Returns the nudge text on success, or `null` if the agent fails
 * or produces an empty result. This function never throws.
 */
export async function generateNudge(input: NudgeInput): Promise<string | null> {
  const prompt = `The developer is working on: ${input.currentPhase}
Current context: ${input.sessionContext}
${input.currentFile ? `They have open: ${input.currentFile}` : 'No file currently open.'}

Generate a brief coaching nudge to help them move forward.`;

  try {
    let result = '';

    const stream = query({
      prompt,
      options: {
        tools: ['Read'],
        allowedTools: ['Read'],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        cwd: input.repoPath,
        systemPrompt: NUDGE_SYSTEM_PROMPT,
        model: 'claude-haiku-4-5-20251001',
        maxTurns: 2,
        persistSession: false,
      },
    });

    for await (const message of stream as AsyncIterable<SDKMessage>) {
      if (message.type === 'result' && message.subtype === 'success') {
        const resultText =
          'result' in message && typeof message.result === 'string'
            ? message.result
            : '';
        result = resultText;
      }
    }

    return result || null;
  } catch {
    return null;
  }
}
