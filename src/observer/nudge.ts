// Nudge delivery via WebSocket broadcast
// Stub for TDD — implementation in T326

export interface NudgePayload {
  signal: string;
  confidence: number;
  context: string;
}

export function deliverNudge(_payload: NudgePayload): void {
  throw new Error('Not implemented');
}

export function broadcastObserverStatus(_active: boolean, _muted: boolean): void {
  throw new Error('Not implemented');
}
