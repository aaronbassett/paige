// Nudge delivery via WebSocket broadcast, optionally enriched by the Agent SDK
// nudge agent. Falls back to raw signal/context when the agent returns null.

import { broadcast } from '../websocket/server.js';
import { generateNudge } from '../planning/nudge-agent.js';
import type { ServerToClientMessage, NudgeSignal } from '../types/websocket.js';

export interface NudgePayload {
  signal: string;
  confidence: number;
  context: string;
  phase: string;
  currentFile: string | null;
  repoPath: string;
}

/**
 * Generates a coaching nudge via the Agent SDK and broadcasts it as an
 * `observer:nudge` WebSocket message. If the nudge agent returns null
 * (failure or empty result), falls back to broadcasting the raw signal
 * and context from the triage result.
 */
export async function deliverNudge(payload: NudgePayload): Promise<void> {
  let nudgeContext = payload.context;

  try {
    const agentMessage = await generateNudge({
      sessionContext: payload.context,
      currentPhase: payload.phase,
      currentFile: payload.currentFile,
      repoPath: payload.repoPath,
    });

    if (agentMessage !== null) {
      nudgeContext = agentMessage;
    }
  } catch {
    // Agent failure — fall back to raw triage context silently
  }

  const message: ServerToClientMessage = {
    type: 'observer:nudge',
    data: {
      signal: payload.signal as NudgeSignal,
      confidence: payload.confidence,
      context: nudgeContext,
    },
  };
  broadcast(message);
}

/**
 * Broadcasts an observer:status message to all connected WebSocket clients.
 */
export function broadcastObserverStatus(active: boolean, muted: boolean): void {
  const message: ServerToClientMessage = {
    type: 'observer:status',
    data: { active, muted },
  };
  broadcast(message);
}
