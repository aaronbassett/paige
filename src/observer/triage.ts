// Observer triage model wrapper — calls Haiku for nudge/no-nudge decisions
// Stub for TDD — implementation in T320

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

export function runTriage(_context: TriageContext): Promise<TriageResult> {
  return Promise.reject(new Error('Not implemented'));
}
