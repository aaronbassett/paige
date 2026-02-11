// Observer triage model wrapper — calls Haiku for nudge/no-nudge decisions.
// The Observer invokes runTriage() with a context snapshot, and Haiku returns
// a binary nudge/no-nudge decision with confidence, signal type, and reasoning.

import { callApi } from '../api-client/claude.js';
import { triageSchema } from '../api-client/schemas.js';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface TriageResult {
  should_nudge: boolean;
  confidence: number;
  signal: string;
  reasoning: string;
}

export interface TriageContext {
  sessionId: number;
  recentActions: Array<{ actionType: string; data?: Record<string, unknown>; createdAt: string }>;
  activePhase: { number: number; title: string; description: string } | null;
  openFiles: string[];
}

// ── System Prompt ───────────────────────────────────────────────────────────

const TRIAGE_SYSTEM_PROMPT = `You are the Observer triage model for Paige, an AI coaching tool that monitors junior developer activity during coding sessions.

Your job is to decide whether Paige should proactively nudge the developer right now. You receive a snapshot of recent activity and must make a fast binary decision.

Respond with JSON matching this exact schema:
{
  "should_nudge": boolean,
  "confidence": number (0.0 to 1.0),
  "signal": string (one of: "stuck_on_implementation", "long_idle", "excessive_hints", "repeated_errors"),
  "reasoning": string (brief explanation of your decision)
}

Signal types:
- "stuck_on_implementation": Developer has been working on the same area without meaningful progress
- "long_idle": Developer has been inactive for an extended period
- "excessive_hints": Developer is requesting too many hints without attempting implementation
- "repeated_errors": Developer keeps hitting the same error patterns

Guidelines:
- Only nudge when there is a clear signal the developer needs help
- Set should_nudge to false when the developer appears to be making normal progress
- Higher confidence means you are more certain about your decision
- Keep reasoning concise (1-2 sentences)`;

// ── User Message Builder ────────────────────────────────────────────────────

function buildUserMessage(context: TriageContext): string {
  const parts: string[] = [];

  parts.push(`Session ID: ${String(context.sessionId)}`);

  // Active phase
  if (context.activePhase !== null) {
    parts.push(
      `\nActive Phase: #${String(context.activePhase.number)} — ${context.activePhase.title}`,
    );
    parts.push(`Phase Description: ${context.activePhase.description}`);
  } else {
    parts.push('\nActive Phase: None');
  }

  // Open files
  if (context.openFiles.length > 0) {
    parts.push(`\nOpen Files:\n${context.openFiles.map((f) => `  - ${f}`).join('\n')}`);
  } else {
    parts.push('\nOpen Files: None');
  }

  // Recent actions (last 20 max)
  const actions = context.recentActions.slice(-20);
  if (actions.length > 0) {
    parts.push('\nRecent Actions (newest last):');
    for (const action of actions) {
      const dataStr = action.data !== undefined ? ` | data: ${JSON.stringify(action.data)}` : '';
      parts.push(`  [${action.createdAt}] ${action.actionType}${dataStr}`);
    }
  } else {
    parts.push('\nRecent Actions: None');
  }

  return parts.join('\n');
}

// ── Main Function ───────────────────────────────────────────────────────────

/**
 * Runs triage on the current session context using the Haiku model.
 * Returns a nudge/no-nudge decision with confidence and signal type.
 */
export async function runTriage(context: TriageContext): Promise<TriageResult> {
  const result = await callApi<TriageResult>({
    callType: 'triage_model',
    model: 'haiku',
    systemPrompt: TRIAGE_SYSTEM_PROMPT,
    userMessage: buildUserMessage(context),
    responseSchema: triageSchema,
    sessionId: context.sessionId,
    maxTokens: 512,
  });

  return result;
}
