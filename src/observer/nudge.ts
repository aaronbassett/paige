// Nudge delivery via WebSocket broadcast

import { broadcast } from '../websocket/server.js';
import type { ServerToClientMessage, NudgeSignal } from '../types/websocket.js';

export interface NudgePayload {
  signal: string;
  confidence: number;
  context: string;
}

/**
 * Broadcasts an observer:nudge message to all connected WebSocket clients.
 * Casts the string signal to NudgeSignal since the Observer may produce
 * arbitrary string signals at runtime.
 */
export function deliverNudge(payload: NudgePayload): void {
  const message: ServerToClientMessage = {
    type: 'observer:nudge',
    data: {
      signal: payload.signal as NudgeSignal,
      confidence: payload.confidence,
      context: payload.context,
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
