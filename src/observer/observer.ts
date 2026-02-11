// Per-session Observer class — starts/stops with session, evaluates nudges
// Stub for TDD — implementation in T322

export interface ObserverOptions {
  sessionId: number;
  cooldownMs?: number;
  flowStateThreshold?: number;
  flowStateWindowMs?: number;
  confidenceThreshold?: number;
  bufferUpdateTriggerCount?: number;
  explainRequestTriggerCount?: number;
}

export class Observer {
  constructor(_options: ObserverOptions) {
    // stub
  }

  start(): void {
    throw new Error('Not implemented');
  }

  stop(): void {
    throw new Error('Not implemented');
  }

  setMuted(_muted: boolean): void {
    throw new Error('Not implemented');
  }

  isMuted(): boolean {
    throw new Error('Not implemented');
  }

  isActive(): boolean {
    throw new Error('Not implemented');
  }
}
